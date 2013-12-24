(function() {

  // ソース整理
  // パーティクル
  // 楽器の追加

  var MidiSync = function() {
    return this;
  }
  MidiSync.prototype = {

    init: function() {
      var _this = this;

      this.$alert = $('#alert');
      this.$control = $('#control');
      this.$midiConf = $('#midi_conf');
      this.$midiIn = $('#midi_in');
      this.$midiOut = $('#midi_out');
      this.$midiChannel = $('#midi_channel');
      this.$message = $('#message');
      this.$sendAll = $('#send_all');
      this.$sendBroadcast = $('#send_broadcast');
      this.$messageList = $('#message_list');

      // web midi api
      this.canMidi = this.midiAccess();

      if (this.canMidi) {
        // midi.js 音源ファイルのロード
        this.loadMidiFile(function() {
          _this.$midiConf.css({display: 'block'});
          _this.$control.css({display: 'block'});
        });
      } else {
        _this.$control.css({display: 'block'});
      }

      // socket.io
      this.socket = io.connect(window._address); //ローカル
      // this.socket = io.connect(); //リモート
      this.initServerEvent();
      this.setMessageEvent();

      // particle
      this.particle = new window._Particle('stage', 20000, 400, 10);
      this.particle
        .init()
        .rotation(1.5, 0.25, 0.5);
      // particle.rotation(1.5, 0.25, 0.5);
      // particle.expand(1.05);
      // particle.changeColor(0.2);
      // particle.changeOneColor(255, 0, 255);  
      // particle.setAxisHelper(); 

    },

    loadMidiFile: function(callback) {
      var _this = this;

      var instrument = ['acoustic_guitar_steel', 'woodblock'];
      
      MIDI.loadPlugin({
        soundfontUrl: './midijs/soundfont/',
        instrument: instrument,
        callback: function() {
          // 0
          MIDI.programChange(0, 25);
          MIDI.setVolume(0, 127);
          // 1
          MIDI.programChange(1, 115);
          MIDI.setVolume(1, 127);

          // channel プルダウン初期化
          for( var i = 0; i < instrument.length; i++) {
            _this.$midiChannel.append('<option value="' + i + '">' + instrument[i]  + '</option>');
          }

          if(callback) callback();
        }
      });

    },

    midiAccess: function() {
      var _this = this;

      try {
        navigator
          .requestMIDIAccess()
          .then( function(midiAccess) {
            _this.onMidiSuccess(midiAccess);
          }, function(errorMessage) {
            _this.onMidiFailure(errorMessage);
          });

      } catch (e) {
        this.alert.append('<p>お使いのブラウザはWEB MIDI APIに対応していません。</p>');
        return false;
      }
      return true;
    },

    onMidiSuccess: function(midiAccess) {
      var _this = this;

      console.log('MIDI ready');
      this.midi = midiAccess;

      // プルダウン初期化
      this.inputs = this.midi.inputs();
      for( var i = 0; i < this.inputs.length; i++) {
        this.$midiIn.append('<option value="' + i + '">' + this.inputs[i]['name']  + '</option>');
      }
      this.outputs = this.midi.outputs();      
      for( var i = 0; i < this.outputs.length; i++) {
        this.$midiOut.append('<option value="' + i + '">' + this.outputs[i]['name']  + '</option>');
      }

      // input/output/channelの初期化
      this.inputs[0].addEventListener('midimessage', function(e) {
        _this.onMidiMessage(e);
      });
      _this.output = _this.outputs[0];
      _this.channel = 0;

      // channel変更
      this.$midiIn.on('change', function() {
        var port = $(this).val();
        _this.inputs[port].addEventListener('midimessage', function(e) {
          _this.onMidiMessage(e);
        });
      });
      this.$midiOut.on('change', function() {
        var port = $(this).val();
        _this.output = _this.outputs[port];
      });

      // channel変更
      this.$midiChannel.on('change', function() {
        _this.channel = $(this).val();
      });

    },

    onMidiMessage: function(e) {
      var midiMessage = e.data;

      // console
      var str = 'MIDI message received [' + midiMessage.length + ' bytes]: ';
      for (var i=0; i<midiMessage.length; i++) {
        str += '0x' + midiMessage[i].toString(16) + ' ' ;
      }
      console.log(str);

      // channel指定
      midiMessage[0] = Number('0x'+(midiMessage[0] >> 4).toString(16) + this.channel);

      // this.socket.emit('C_to_S_broadcast', {value:JSON.stringify(midiMessage)});
      this.socket.emit('C_to_S_message', {value:JSON.stringify(midiMessage)});
    },    

    onMidiFailure: function(message) {
      console.log( 'Failed to get MIDI access - ' + message );
    },

    initServerEvent: function() {
      var _this = this;

      //サーバから受け取るイベント
      this.socket.on('connect', function () {});  // 接続時

      this.socket.on('disconnect', function (client) {});  // 切断時
      
      this.socket.on('S_to_C_message', function (data) {

        // ※※編集予定

        // {'0':144,'1':36,'2':127}
        try {
          var o =  JSON.parse(data.value);
          var str = '';
          for (var i = 0 in o) {
              str += '0x' + o[i].toString(16) + ' ' ;
          }
          _this.addMessage(str);
        } catch (e){
          _this.addMessage(data.value);
          return;
        }

        var midiMessage = [];
        for(var i = 0 in o ) {
          midiMessage[i] = o[i];
        }
        var delay = 0,
            note = midiMessage[0].toString(16).split('')[0],
            channel = midiMessage[0].toString(16).split('')[1];
        console.log('channel:' + channel + ',' + 'note:' + note);
        console.log(midiMessage[1], midiMessage[2]);

        if (note == 9) {
          MIDI.noteOn(channel, midiMessage[1], midiMessage[2], delay);

          _this.particle
            .expand(midiMessage[1]/30)
            .changeColor(1);

        } else if (note == 8) {
          MIDI.noteOff(channel, midiMessage[1], delay);
          _this.particle
            .changeOneColor(midiMessage[1]*6, midiMessage[1]*6, midiMessage[1]*6);
        }

        if (_this.output) {
          var buffer = new Uint8Array(midiMessage);
          _this.output.send(buffer);
        }
      });
    },

    addMessage: function(value) {
      var message = value.replace( /[!@$%<>'"&|]/g, '' ); //タグ記号とかいくつか削除
      this.$messageList.prepend('<div>' + message + '</div>');
    },

    setMessageEvent: function() {
      var _this = this;
      
      this.$sendAll.on('click', function() {
        var message = _this.$message.val();
        if (message == '') return false;
        _this.$message.val('');
        _this.socket.emit('C_to_S_message', { value: message });
        return false;
      });

      this.$sendBroadcast.on('click', function() {
        var message = _this.$message.val();
        if (message == '') return false;
        _this.$message.val('');
        _this.socket.emit('C_to_S_broadcast', { value: message });
        return false;
      });

    }    

  }

  var midiSync = new MidiSync;
  midiSync.init();

})();