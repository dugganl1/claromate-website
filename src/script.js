/**
 * Base Setup
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
// We'll need this for merging cloud geometries
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Final cloud settings
const debugParams = {
  fogColor: 0x5ba0d0, // Brighter, more saturated blue
  fogNear: 100, // Moved further away to reduce grey fog mixing
  fogFar: 2000,
  shaderPower: 15.0, // Reduced to make clouds less harsh
  cloudOpacity: 0.6, // Slightly increased for more vibrant clouds
  enableSecondLayer: true,
  renderGammaCorrection: false,
};

// Cloud shader with adjustable parameters
const cloudShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float shaderPower;
    uniform float cloudOpacity;
    varying vec2 vUv;

    void main() {
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep( fogNear, fogFar, depth );

      vec4 texColor = texture2D( map, vUv );
      
      // Brighten the cloud texture slightly to reduce grey appearance
      texColor.rgb = mix(texColor.rgb, vec3(1.0), 0.1);
      
      gl_FragColor = texColor;
      gl_FragColor.w *= pow( gl_FragCoord.z, shaderPower );
      gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
      gl_FragColor.a *= cloudOpacity;
    }
  `,
};

// Variables to store cloud meshes
let cloudMesh, cloudMeshA, cloudMaterial, fog;
const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();

// Variables for cloud animation
let mouseX = 0,
  mouseY = 0;
let startTime = Date.now();
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader();

// Load your existing matcap for text
const matcapTexture = textureLoader.load("/textures/matcaps/custom.png");
matcapTexture.colorSpace = THREE.SRGBColorSpace;

// Load cloud texture - back to Mr. Doob's original
const cloudTexture = textureLoader.load(
  "https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png"
);
cloudTexture.colorSpace = THREE.SRGBColorSpace;
cloudTexture.magFilter = THREE.LinearMipMapLinearFilter;
cloudTexture.minFilter = THREE.LinearMipMapLinearFilter;

/**
 * Create background gradient (enhanced for more euphoric feel)
 */
function createBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = window.innerHeight;

  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);

  // Enhanced gradient for brighter, more euphoric feel (like Mr. Doob's)
  gradient.addColorStop(0, "#87ceeb"); // Bright sky blue at top
  gradient.addColorStop(0.3, "#6bb6ff"); // Vibrant blue
  gradient.addColorStop(0.7, "#5ba0d0"); // Medium blue
  gradient.addColorStop(1, "#4a90e2"); // Deeper blue at bottom

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  document.body.style.background = "url(" + canvas.toDataURL("image/png") + ")";
  document.body.style.backgroundSize = "32px 100%";

  // Force a single render to ensure color space is applied correctly
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Create Clouds
 */
function createClouds() {
  // Set up fog
  fog = new THREE.Fog(debugParams.fogColor, debugParams.fogNear, debugParams.fogFar);
  scene.fog = fog;

  // Cloud material using shader
  cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { type: "t", value: cloudTexture },
      fogColor: { type: "c", value: fog.color },
      fogNear: { type: "f", value: fog.near },
      fogFar: { type: "f", value: fog.far },
      shaderPower: { type: "f", value: debugParams.shaderPower },
      cloudOpacity: { type: "f", value: debugParams.cloudOpacity },
    },
    vertexShader: cloudShader.vertexShader,
    fragmentShader: cloudShader.fragmentShader,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  });

  // Create cloud geometry
  const planeGeo = new THREE.PlaneGeometry(64, 64);
  const planeObj = new THREE.Object3D();
  const geometries = [];

  // Generate many cloud planes
  for (let i = 0; i < 8000; i++) {
    planeObj.position.x = Math.random() * 1000 - 500;
    planeObj.position.y = -Math.random() * Math.random() * 200 - 15;
    planeObj.position.z = i;
    planeObj.rotation.z = Math.random() * Math.PI;
    planeObj.scale.x = planeObj.scale.y = Math.random() * Math.random() * 1.5 + 0.5;
    planeObj.updateMatrix();

    const clonedPlaneGeo = planeGeo.clone();
    clonedPlaneGeo.applyMatrix4(planeObj.matrix);
    geometries.push(clonedPlaneGeo);
  }

  // Merge all cloud geometries for performance
  const mergedCloudGeo = BufferGeometryUtils.mergeGeometries(geometries);
  cloudMesh = new THREE.Mesh(mergedCloudGeo, cloudMaterial);
  cloudMesh.renderOrder = 2;

  // Create a second layer of clouds further back
  cloudMeshA = cloudMesh.clone();
  cloudMeshA.position.z = -8000;
  cloudMeshA.renderOrder = 1;
  cloudMeshA.visible = debugParams.enableSecondLayer;

  scene.add(cloudMesh);
  scene.add(cloudMeshA);
}

/**
 * Fonts & Text (improved for better cross-device compatibility)
 */
const fontLoader = new FontLoader();
fontLoader.load("/fonts/helvetiker_regular.typeface.json", (font) => {
  const textGeometry = new TextGeometry("coming soon", {
    font: font,
    size: 0.5,
    depth: 0.2,
    curveSegments: 5,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 4,
  });

  textGeometry.center();

  const textMaterial = new THREE.MeshMatcapMaterial({
    matcap: matcapTexture,
    transparent: false, // Ensure text is fully opaque
  });
  const text = new THREE.Mesh(textGeometry, textMaterial);

  // Position text prominently in the foreground
  text.position.z = 500; // Moved much closer to camera
  text.renderOrder = 999; // Ensure text renders on top

  // Ensure text doesn't move with camera
  text.position.x = 0;
  text.position.y = 0;

  scene.add(text);
});

/**
 * Camera Setup (improved for better mobile compatibility)
 */
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 6000; // Start far back like in Mr. Doob's version

/**
 * Renderer (improved settings)
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true, // Changed to true for better quality
  alpha: false, // Explicitly set to false for better performance
  powerPreference: "high-performance", // Better for animations
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Set to Linear color space from the start (this is what looks better)
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// Set the clear color to match the brighter background
renderer.setClearColor(0x5ba0d0, 1.0);

// Enable sorting for proper transparency rendering
renderer.sortObjects = true;

/**
 * Event Listeners (improved for touch devices)
 */
function onDocumentMouseMove(event) {
  // Reduced sensitivity for subtle movement
  mouseX = (event.clientX - windowHalfX) * 0.05;
  mouseY = (event.clientY - windowHalfY) * 0.03;
}

function onDocumentTouchMove(event) {
  event.preventDefault();
  if (event.touches.length === 1) {
    // Reduced sensitivity for subtle movement
    mouseX = (event.touches[0].pageX - windowHalfX) * 0.05;
    mouseY = (event.touches[0].pageY - windowHalfY) * 0.03;
  }
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  // Recreate background gradient on resize
  createBackground();
}

document.addEventListener("mousemove", onDocumentMouseMove, false);
document.addEventListener("touchmove", onDocumentTouchMove, false);
window.addEventListener("resize", onWindowResize, false);

/**
 * Animation Loop
 */
function animate() {
  requestAnimationFrame(animate);

  // Cloud movement animation
  const position = ((Date.now() - startTime) * 0.03) % 8000;

  // Smooth camera movement based on mouse/touch - much more subtle
  camera.position.x += (mouseX - camera.position.x) * 0.005;
  camera.position.y += (-mouseY - camera.position.y) * 0.005;
  camera.position.z = -position + 8000;

  renderer.render(scene, camera);
}

/**
 * Initialize Everything
 */
function init() {
  createBackground();
  createClouds();
  animate();
}

// Start when cloud texture is loaded
init();
