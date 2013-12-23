(function() {

  // ソース整理
  // 勝手に０番目をインアウトに
  // パーティクル
  // 楽器の追加

  var MidiSync = function() {
    return this;
  }
  MidiSync.prototype = {

    init: function() {
      
      // midi.js 音源ファイルのロード
      this.loadMidiFile(function() {

      });

      // web midi api
      this.midiAccess();
      
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

      var instrument = ['woodblock', 'acoustic_guitar_steel'];
      
      MIDI.loadPlugin({
        soundfontUrl: './midijs/soundfont/',
        instrument: instrument,
        callback: function() {
          // 0
          MIDI.programChange(0, 115);
          MIDI.setVolume(0, 127);
          // 1
          MIDI.programChange(1, 25);
          MIDI.setVolume(1, 127);

          _this.initChannel(instrument.length);

          if(callback) callback();
        }
      });

    },

    initChannel: function(l) {
      for( var i = 0; i < l; i++) {
        $('#midi_channel').append('<option value="' + i + '">Channel ' + i  + '</option>');
      }
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
        $('#info').append('<p>お使いのブラウザはWEB MIDI APIに対応していません。</p>');
        this.canMidi = false;
        return;
      }
      this.canMidi = true;
      return;
    },

    onMidiSuccess: function(midiAccess) {
      var _this = this;

      console.log( 'MIDI ready!' );
      this.midi = midiAccess;

      var $midiIn = $('#midi_in'),
          $midiOut = $('#midi_out');

      // プルダウン初期化
      this.inputs = this.midi.inputs();
      for( var i = 0; i < this.inputs.length; i++) {
        $midiIn.append('<option value="' + i + '">' + this.inputs[i]['name']  + '</option>');
      }
      this.outputs = this.midi.outputs();      
      for( var i = 0; i < this.outputs.length; i++) {
        $midiOut.append('<option value="' + i + '">' + this.outputs[i]['name']  + '</option>');
      }

      // ポート変更のイベントをセット
      $midiIn.on('change', function() {
        var port = $(this).find('option:selected').val();
        _this.inputs[port].addEventListener('midimessage', function(e) {
          _this.onMidiMessage(e);
        });
      });
      $midiOut.on('change', function() {
        var port = $(this).find('option:selected').val();
        _this.output = _this.outputs[port];
      });
    },

    onMidiMessage: function(e) {
      var str = 'MIDI message received [' + e.data.length + ' bytes]: ';

      var channel = $('#midi_channel').val();
      e.data[0] = Number('0x'+(e.data[0] >> 4).toString(16)+channel);

      for (var i=0; i<e.data.length; i++) {
          str += '0x' + e.data[i].toString(16) + ' ' ;
      }
      // this.socket.emit('C_to_S_broadcast', {value:JSON.stringify(e.data)});
      this.socket.emit('C_to_S_message', {value:JSON.stringify(e.data)});
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
      $('#message_list').prepend('<div>' + message + '</div>');
    },

    setMessageEvent: function() {
      var _this = this;
      var $message = $('#message');
      
      $('#send_all').on('click', function() {
        var message = $message.val();
        $message.val('');
        _this.socket.emit('C_to_S_message', {value:message});
        return false;
      });

      $('#send_broadcast').on('click', function() {
        var message = $message.val();
        $message.val('');
        _this.socket.emit('C_to_S_broadcast', {value:message});
        return false;
      });

    }    

  }

  var midiSync = new MidiSync;
  midiSync.init();

})();