(function() {

  if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

  var Particle = function(id, length, size, particleSize) {
    this.length = 15000 || length;
    this.size = size || 400;
    this.particleSize = particleSize || 10;
    this.id = id;
    return this;
  }
  Particle.prototype = {

    init: function() {
      var _this = this;

      // rendering
      this.container = document.getElementById( this.id );
      this.initStage();
      this.setStats();

      window.addEventListener( 'resize', function() {
        _this.resize();
      }, false );

      this.translate = {};
      setTimeout(function() {
        _this.tick();
      }, 1500);

      return this;
    },

    initStage: function() {

      this.camera = new THREE.PerspectiveCamera( 27, window.innerWidth / window.innerHeight, 5, 3500 );
      this.camera.position.set(0, 0, 2750);

      // scene
      this.scene = new THREE.Scene();
      // http://www.atmarkit.co.jp/ait/articles/1210/04/news142_4.html 
      // 視点から遠くにある物体を特定の色に近づけることで、シーン全体に霞が掛かっているような効果を実現するのが「フォグ」機能です。Three.jsでは、シーンのfogプロパティにFog、もしくはFogExp2インスタンスを設定し、マテリアルのfogパラメータをtrueにすることで利用できます。
      this.scene.fog = new THREE.Fog( 0x101010, 2000, 3500 );  

      // http://www.atmarkit.co.jp/ait/articles/1210/04/news142_4.html
      // Three.jsでパーティクルを表示するには、Geometryインスタンスのverticesプロパティに全パーティクルの座標を格納した上で、専用の物体（ParticleSystem）とマテリアル（ParticleBasicMaterial）を組み合わせます。こうすることで、個々の頂点がパーティクルとして扱われます。
      this.geometry = new THREE.Geometry();

      var n = this.size * 2, // 直径
          n2 = n / 2; // particles spread in the cube
      for ( var i = 0; i < this.length; i++ ) {
        // positions
        var x = Math.random() * n - n2;
        var y = Math.random() * n - n2;
        var z = Math.random() * n - n2;

        v = new THREE.Vector3( x, y, z ).normalize().setLength( 400 )
        v.ov = v.clone()

        this.geometry.vertices.push(v);

        // colors
        var vx = ( x / n ) + 0.5;
        var vy = ( y / n ) + 0.5;
        var vz = ( z / n ) + 0.5;
        var color = new THREE.Color();
        color.setRGB( vx, vy, vz );
        this.geometry.colors.push(color);
      }

      // 境界線
      this.geometry.computeBoundingSphere();

      // ParticleSystemMaterialと生成したgeometryをpertycleSystemに格納
      var material = new THREE.ParticleSystemMaterial( { size: this.particleSize, vertexColors: true } );
      // mesh
      this.particleSystem = new THREE.ParticleSystem( this.geometry, material );
      this.particleSystem.sortParticles = true;
      // sceneにParticleSystemを追加
      this.scene.add( this.particleSystem );     

      // renderer
      this.renderer = new THREE.WebGLRenderer( { antialias: false, alpha: false } );
      this.renderer.setClearColor( this.scene.fog.color, 1 );
      this.renderer.setSize( window.innerWidth, window.innerHeight );

      this.container.appendChild( this.renderer.domElement );

    },

    setStats: function() {
      // fps
      this.stats = new Stats();
      this.stats.domElement.style.position = 'absolute';
      this.stats.domElement.style.top = '0px';

      this.container.appendChild( this.stats.domElement );
    },

    setAxisHelper: function() {
      // helper
      var axis = new THREE.AxisHelper(1000);
      axis.position.set(0,0,0);
      this.scene.add(axis);
    },

    resize: function() {
      windowHalfX = window.innerWidth / 2;
      windowHalfY = window.innerHeight / 2;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize( window.innerWidth, window.innerHeight );
    },

    render: function() {
      for (var name in this.translate) {
        if (this.translate[name]) this.translate[name]();
      }
      this.renderer.render( this.scene, this.camera );
    },

    tick: function() {
      var _this = this;
      var oneFrame = function() {
        requestAnimationFrame( oneFrame );
        _this.render();
        _this.stats.update();
      }
      oneFrame();
    },

    // _sortCircle: function() {
    //   var n = this.size,
    //       n2 = n / 2;
    //   for ( var i = 0; i < this.length; i++ ) {
    //     // position
    //     var position = this.geometry.vertices[i];
    //     var x = Math.random() * n / 2;
    //     x = Math.random() > 0.5 ? -x : x;
    //     var y = Math.random() * n / 2;
    //     y = Math.random() > 0.5 ? y * -1 : y;        
    //     var z = Math.random() * n / 2;
    //     z = Math.random() > 0.5 ? z * -1 : z;
    //     position.x = x;
    //     position.y = y;
    //     position.z = z;

    //     // colors
    //     var vx = ( x / n ) + 0.5;
    //     var vy = ( y / n ) + 0.5;
    //     var vz = ( z / n ) + 0.5;
    //     var color = new THREE.Color();
    //     color.setRGB( vx, vy, vz );
    //     this.geometry.colors[i] = color;
    //   }
    //   this.geometry.computeBoundingSphere();      
    // },

    // sortCircle: function() {
    //   this._sortCircle();
    //   return this;
    // },

    _rotaion: function(v, x, y) {
      v = v || 1;
      v = v / 1000;
      x = x || 0.5;
      y = y || 0.5;
      var time = Date.now() * v;
      this.particleSystem.rotation.x = time * x;
      this.particleSystem.rotation.y = time * y;
    },

    rotation: function(v, x, y) {
      var _this = this;
      this.translate['rotaion'] = function() {
        _this._rotaion(v, x, y);
      };
      return this;
    },

    stopRotaion: function() {
      delete this.translate['rotaion'];
      return this;
    },

    _expand: function(v, end) {
      v = v || 1.1;
      var vertices = this.geometry.vertices;
      for ( var i = 0; i < this.length; i++ ) {
        var p = vertices[i], po = p.ov;
        p.x += (po.x - p.x) * 0.1;
        p.y += (po.y - p.y) * 0.1;
        p.z += (po.z - p.z) * 0.1;
      }
    },

    getRandomVectorNorm: function(){
      var x,y,z=0;
      x = Math.random() - 0.5;
      y = Math.random() - 0.5;
      z = Math.random() - 0.5;
      return new THREE.Vector3( x, y, z );
    },

    getRandomPointOnSphere: function() {
      var r = 400,
          d2r = Math.PI/180,
          radZ = 360*Math.random()*d2r,
          radX = 360*Math.random()*d2r;

      return new THREE.Vector3(
        r * Math.sin(radZ)*Math.cos(radX),
        r * Math.sin(radZ)*Math.sin(radX),
        r * Math.cos(radZ)
      );
    },

    getVectorInRange: function(v, range) {
      var range = range || 60,
          ret = [],
          vertices = this.geometry.vertices;

      for ( var i = 0; i < this.length; i++ ) {
        var p = vertices[i];
        if( p.distanceToSquared(v) < range*range ) {
          ret.push(p);
        }
      }
      return ret;
    },

    explode: function(){
      var v = this.getRandomPointOnSphere(),
          arr = this.getVectorInRange(v, 300),
          p, i = 0, len = arr.length;
      for(;i<len;i++) {
        p = arr[i];
        p.add( this.getRandomVectorNorm().setLength( 500*Math.random() ));
      }
    },

    beat: function(){
      var vertices = this.geometry.vertices;
      for ( var i = 0; i < this.length; i++ ) {
        var p = vertices[i]
        p.x *= 1 + .6*Math.random();
        p.y *= 1 + .6*Math.random();
        p.z *= 1 + .6*Math.random();
      }
    },

    expand: function(v, end) {
      this.beat();
      this.explode();
      var _this = this;
      this.translate['expand'] = function() {
        _this._expand(v, end);
      };
      return this;
    },

    stopExpand: function() {
      delete this.translate['expand'];
      return this;
    },

    _changeColor: function(v) {
      v = v || 0.5;
      var n = this.size * 2; // 直径
      for ( var i = 0; i < this.length; i++ ) {
        var position = this.geometry.vertices[i];
        // colors
        var vx = ( position.x / n ) + v;
        var vy = ( position.y / n ) + v;
        var vz = ( position.z / n ) + v;
        var color = new THREE.Color();
        color.setRGB( vx, vy, vz );
        this.geometry.colors[i] = color;
      }
    },

    changeColor: function(v) {
      this._changeColor(v);
      return this;
    },

    _changeOneColor: function(r, g, b) {
      for ( var i = 0; i < this.length; i++ ) {
        var position = this.geometry.vertices[i];
        // colors
        var color = new THREE.Color();
        color.setRGB(r / 255, g / 255, b / 255);
        this.geometry.colors[i] = color;
      }
    },

    changeOneColor: function(r, g, b) {
      this._changeOneColor(r, g, b);
      return this;
    }

  }

  window._Particle = Particle;

  // particle = new Particle('stage', 20000, 400, 10);
  // particle.init();
  // particle.rotation(1.5, 0.25, 0.5);
  // particle.expand(1.05, 500);
  // particle.changeColor(0.2);
  // particle.changeOneColor(255, 0, 255);  
  // particle.setAxisHelper(); 

cccc})();
