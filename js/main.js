(function() {

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
        _this.$midiConf.css({display: 'block'});
      }
      // midi.js 音源ファイルのロード
      this.loadMidiFile(function() { 
        _this.$control.show().animate({right: 0, opacity: 1}, 300, 'swing');        
      });

      // socket.io
      if (window._address) {
        this.socket = io.connect(window._address); //ローカル        
      } else {
        this.socket = io.connect(); //リモート
      }
      this.initServerEvent();
      this.setMessageEvent();

      // particle
      this.particle = new window._Particle('stage', 30000, 400, 10);
      this.particle
          .init()
          .rotation(1.5, 0.25, 0.5)
          .backOrigin(.2);      
      setTimeout(function() {
        $('#stage').fadeIn(800);  
      }, 2000);
      
      document.addEventListener("click", function(){
        _this.particle.expand();
      }, false);

    },

    loadMidiFile: function(callback) {
      var _this = this;
      var instrument = ['bright_acoustic_piano', 'synth_drum', 'alto_sax', 'melodic_tom', 'music_box'];//'fx_3_crystal'
      
      // https://en.wikipedia.org/wiki/General_MIDI
      MIDI.loadPlugin({
        soundfontUrl: './midijs/soundfont/',
        instrument: instrument,
        callback: function() {
          // 0
          MIDI.programChange(0, 1);
          // MIDI.setVolume(0, 127);
          // 1
          MIDI.programChange(1, 118);
          // 2
          MIDI.programChange(2, 65);
          // 3
          MIDI.programChange(3, 117);
          // 4
          MIDI.programChange(4, 10);
          // 5
          // MIDI.programChange(5, 98);

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
        this.$alert.append('<p>お使いのブラウザはWEB MIDI APIに対応していません。</p>');
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

        // {"0":144,"1":29,"2":127} 
        var data = data.value;

        try {
          var messageObj =  JSON.parse(data);
        } catch (e) {
          _this.addMessage(data);
          return;
        }

        // 数値をメッセージウインドウに表示表示
        var str = '';
        for (var i = 0 in messageObj) {
            str += '0x' + messageObj[i].toString(16) + ' ' ;
        }
        _this.addMessage(str);

        // 配列に変換
        var midiMessage = [];
        for(var i = 0 in messageObj) {
          midiMessage[i] = messageObj[i];
        }

        // parse
        var note = midiMessage[0].toString(16).split('')[0],
            channel = midiMessage[0].toString(16).split('')[1],
            position = midiMessage[1],
            velocity = midiMessage[2],
            delay = 0;

        console.log([
          'note:' + note,
          'channel:' + channel,
          'position:' + position,
          'velocity:' + velocity
        ].join(', '));

        // midiOutput
        if (_this.output) {
          var buffer = new Uint8Array(midiMessage);
          _this.output.send(buffer);
        }        

        if (! MIDI.noteOn) return;

        // noteOn
        if (note == 9) {
          MIDI.noteOn(channel, position, velocity, delay);
          _this.particleTransform(channel);
          _this.particle
            .expand(position / 30)
            .changeOneColor(position*6, position*6, position*6);

        // noteOff
        } else if (note == 8) {
          MIDI.noteOff(channel, position, delay);
          _this.particle
            .changeColor(1, true);
        }

      });
    },

    particleTransform: function(channel) {
      var p = this.particle;
      switch (+channel) {
        case 0:
          p.sortCircle()
            .rotation(1.5, Math.random() * .5, Math.random() * .5);
          break;
        case 1:
          p.sortSquare()
            .rotation(2, Math.random() * .5, Math.random() * .5);
          break;
        case 2:
          p.sortFillSquare()
            .rotation(1.5, Math.random() * .5, Math.random() * .5);                    
          break;
        case 3:
          p.sortPlane()
            .rotation(1.2, Math.random() * .5, Math.random() * .5);
          break;
        case 4:
          p.sortLine()
            .rotation(2.5, Math.random() * 1, Math.random() * 1);            
          break;
      }
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

  window.midiSync = new MidiSync;
  midiSync.init();

})();
