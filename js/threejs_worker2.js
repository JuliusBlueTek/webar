function isMobile () {
  return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

var setMatrix = function (matrix, value) {
  var array = [];
  for (var key in value) {
    array[key] = value[key];
  }
  if (typeof matrix.elements.set === "function") {
    matrix.elements.set(array);
  } else {
    matrix.elements = [].slice.call(array);
  }
};

function start(container, markerUrl, workerPath, video, input_width, input_height, canvas_draw) {
  var vw, vh;
  var sw, sh;
  var pscale, sscale;
  var w, h;
  var pw, ph;
  var ox, oy;
  var worker;
  var camera_para = 'https://arjs-cors-proxy.herokuapp.com/https://raw.githack.com/JuliusBlueTek/webar/main/js/camera_para.dat'

  var canvas_process = document.createElement('canvas');
  var context_process = canvas_process.getContext('2d');

  var renderer = new THREE.WebGLRenderer({ canvas: canvas_draw, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  var scene = new THREE.Scene();

  var camera = new THREE.Camera();
  camera.matrixAutoUpdate = false;
  scene.add(camera);

  const light = new THREE.AmbientLight( 0xffffff, 1 ); // soft white light
  scene.add( light );



  var root = new THREE.Group();
  var offset = new THREE.Group();

  offset.position.z = 10;
  offset.position.x = 300;
  offset.position.y = 300;
  offset.scale.set(30, 30, 30);

  root.matrixAutoUpdate = false;
  scene.add(root);
  root.add(offset);

  var loader = new THREE.GLTFLoader();
  var mixer;
  var clock = new THREE.Clock();

  // Load a glTF resource
  loader.load(
    // resource URL
    'pill.gltf',
    // called when the resource is loaded
    function ( gltf ) {
      var model = gltf.scene;

      offset.add( model );

      mixer = new THREE.AnimationMixer( model );
      gltf.animations.forEach( ( clip ) => {
        
          mixer.clipAction( clip ).play();
        
      } );
    },
    // called while loading is progressing
    function ( xhr ) {

      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

    },
    // called when loading has errors
    function ( error ) {

      console.log( 'An error happened' );

    }
  );

  var load = function () {
    vw = input_width;
    vh = input_height;

    pscale = 320 / Math.max(vw, vh / 3 * 4);
    sscale = isMobile() ? window.outerWidth / input_width : 1;

    sw = vw * sscale;
    sh = vh * sscale;

    w = vw * pscale;
    h = vh * pscale;
    pw = Math.max(w, h / 3 * 4);
    ph = Math.max(h, w / 4 * 3);
    ox = (pw - w) / 2;
    oy = (ph - h) / 2;
    canvas_process.style.clientWidth = pw + "px";
    canvas_process.style.clientHeight = ph + "px";
    canvas_process.width = pw;
    canvas_process.height = ph;

    renderer.setSize(sw, sh);

    worker = new Worker('https://raw.githack.com/JuliusBlueTek/webar/main/js/artoolkitNFT.worker.js');

    worker.postMessage({ type: "load", pw: pw, ph: ph, camera_para: camera_para, marker: markerUrl });

    worker.onmessage = function (ev) {
      var msg = ev.data;
      switch (msg.type) {
        case "loaded": {
          var proj = JSON.parse(msg.proj);
          var ratioW = pw / w;
          var ratioH = ph / h;
          proj[0] *= ratioW;
          proj[4] *= ratioW;
          proj[8] *= ratioW;
          proj[12] *= ratioW;
          proj[1] *= ratioH;
          proj[5] *= ratioH;
          proj[9] *= ratioH;
          proj[13] *= ratioH;
          setMatrix(camera.projectionMatrix, proj);
          break;
        }
        case "endLoading": {
          if (msg.end == true) {
            // removing loader page if present
            var loader = document.getElementById('loading');
            if (loader) {
              loader.querySelector('.loading-text').innerText = 'Start the tracking!';
              setTimeout(function(){
                loader.parentElement.removeChild(loader);
              }, 2000);
            }
          }
          break;
        }
        case 'found': {
          found(msg);
          break;
        }
        case 'not found': {
          found(null);
          break;
        }
      }
      //track_update();
      process();
    };
  };

  var world;

  var found = function (msg) {
    if (!msg) {
      world = null;
    } else {
      world = JSON.parse(msg.matrixGL_RH);
    }
  };

  var lasttime = Date.now();
  var time = 0;

  var draw = function () {
    //render_update();
    var now = Date.now();
    var dt = now - lasttime;
    time += dt;
    lasttime = now;

    if (!world) {
      scene.visible = false;
    } else {
      scene.visible = true;
      // set matrix of 'root' by detected 'world' matrix
      setMatrix(root.matrix, world);
    }

    var delta = clock.getDelta();
    if ( mixer ) mixer.update( delta );

    renderer.render(scene, camera);
  };

  var process = function () {
    context_process.fillStyle = 'black';
    context_process.fillRect(0, 0, pw, ph);
    context_process.drawImage(video, 0, 0, vw, vh, ox, oy, w, h);

    var imageData = context_process.getImageData(0, 0, pw, ph);
    worker.postMessage({ type: 'process', imagedata: imageData }, [imageData.data.buffer]);
  }
  var tick = function () {
    draw();
    requestAnimationFrame(tick);
  };

  load();
  tick();
  process();
}
