<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Gyro / Mouse Plane Viewer</title>
  <style>
    body {
      margin: 0;
      overflow: hidden; /* Untuk menghilangkan scroll */
      background: #000;
    }
    canvas {
      display: block; /* Menghapus space kosong di bawah canvas */
      width: 100%;
      height: 100%;
      object-fit: cover; /* Menjaga proporsi saat merubah ukuran */
    }
    #ui {
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      z-index: 10;
      color: white;
      font-family: sans-serif;
      background: rgba(0, 0, 0, 0.5);
      padding: 0px;
      border-radius: 0px;
    }
  </style>
</head>
<body>
  <div id="ui">
    <label>
      <input type="radio" name="inputMode" value="gyro" checked /> Gyroscope
    </label>
    <label>
      <input type="radio" name="inputMode" value="mouse" /> Mouse Move
    </label>
    <br /><br />
    <button id="recalibrateBtn">Kalibrasi Ulang</button>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js"></script>
  <script>
    const settings = {
      sizes: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      boxDimensions: {
        h: 1.4,
        w: 1
      }
    };

    const textureLoader = new THREE.TextureLoader();
    const photoTexture02 = textureLoader.load('https://assets.codepen.io/4201020/city2.png');
    const photoTexture03 = textureLoader.load('https://assets.codepen.io/4201020/shopp-e-1731593813681771088199459824.png');
    const photoTexture = textureLoader.load('https://assets.codepen.io/4201020/shopp-e-1731594468645280783813006762.png');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, settings.sizes.width / settings.sizes.height, 0.1, 1000);
    camera.position.set(0, 0, 3);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(settings.sizes.width, settings.sizes.height);
    document.body.appendChild(renderer.domElement);

    const planeGeometry = new THREE.PlaneGeometry(settings.boxDimensions.w, settings.boxDimensions.h);

    function RoundedPortalPhotoPlane(geometry, texture) {
      const material = new THREE.MeshMatcapMaterial({
        matcap: texture,
        transparent: true,
      });

      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `
            #include <common>
            varying vec4 vPosition;
            varying vec2 vUv;
          `
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <fog_vertex>',
          `
            #include <fog_vertex>
            vPosition = mvPosition;
            vUv = uv;
          `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          `#include <common>`,
          `
            #include <common>
            varying vec4 vPosition;
            varying vec2 vUv;
            float roundedBoxSDF(vec2 CenterPosition, vec2 Size, float Radius) {
              return length(max(abs(CenterPosition)-Size+Radius,0.0))-Radius;
            }
          `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          `#include <dithering_fragment>`,
          `
            #include <dithering_fragment>
            vec2 size = vec2(1.0, 1.0);
            float edgeSoftness  = 0.001;
            float radius = 0.08;
            float distance  = roundedBoxSDF(vUv.xy - (size/2.0), size/2.0, radius);
            float smoothedAlpha =  1.0 - smoothstep(0.0, edgeSoftness * 2.0, distance);
            gl_FragColor = vec4(outgoingLight, smoothedAlpha);
          `
        );
      };

      return new THREE.Mesh(geometry, material);
    }

    const planeGroup = new THREE.Group();

    const photoPlane01 = new RoundedPortalPhotoPlane(planeGeometry, photoTexture02);
    photoPlane01.position.set(-1, 0, 1);
    photoPlane01.rotation.y = Math.PI * 0.1;
    planeGroup.add(photoPlane01);

    const photoPlane02 = new RoundedPortalPhotoPlane(planeGeometry, photoTexture);
    photoPlane02.position.set(0, 0, 0.5);
    planeGroup.add(photoPlane02);

    const photoPlane03 = new RoundedPortalPhotoPlane(planeGeometry, photoTexture03);
    photoPlane03.position.set(1, 0, 1);
    photoPlane03.rotation.y = Math.PI * -0.1;
    planeGroup.add(photoPlane03);

    scene.add(planeGroup);

    // State
    let inputMode = 'gyro';
    let initialBeta = null, initialGamma = null;

    const recalibrateBtn = document.getElementById('recalibrateBtn');
    const inputRadios = document.querySelectorAll('input[name="inputMode"]');

    inputRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        inputMode = e.target.value;
        recalibrateBtn.disabled = inputMode !== 'gyro';
      });
    });

    recalibrateBtn.addEventListener('click', () => {
      initialBeta = null;
      initialGamma = null;
    });

    // Mouse
    const mouse = new THREE.Vector2();
    window.addEventListener('mousemove', (event) => {
      mouse.x = (event.clientX / settings.sizes.width) * 2 - 1;
      mouse.y = - (event.clientY / settings.sizes.height) * 2 + 1;
    });

    // Gyro
    window.addEventListener('deviceorientation', (event) => {
      if (inputMode !== 'gyro') return;
      const { beta, gamma } = event;

      if (initialBeta === null) {
        initialBeta = beta;
        initialGamma = gamma;
        return;
      }

      const deltaBeta = beta - initialBeta;
      const deltaGamma = gamma - initialGamma;

      const xRotation = THREE.MathUtils.degToRad(deltaBeta);
      const yRotation = THREE.MathUtils.degToRad(deltaGamma);

      planeGroup.rotation.x += (xRotation * 0.5 - planeGroup.rotation.x) * 0.1;
      planeGroup.rotation.y += (yRotation * 0.5 - planeGroup.rotation.y) * 0.1;
    });

    // Resize listener
    window.addEventListener('resize', () => {
      settings.sizes.width = window.innerWidth;
      settings.sizes.height = window.innerHeight;
      renderer.setSize(settings.sizes.width, settings.sizes.height);
      camera.aspect = settings.sizes.width / settings.sizes.height;
      camera.updateProjectionMatrix();
    });

    // Render
    const clock = new THREE.Clock();
    let previousTime = 0;

    function animation() {
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = elapsedTime - previousTime;
      previousTime = elapsedTime;

      if (inputMode === 'mouse') {
        const parallaxX = mouse.x * -0.3;
        const parallaxY = mouse.y * 0.3;
        planeGroup.rotation.y += (parallaxX - planeGroup.rotation.y) * 3 * deltaTime;
        planeGroup.rotation.x += (parallaxY - planeGroup.rotation.x) * 3 * deltaTime;
      }

      renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(animation);
  </script>
</body>
</html>
