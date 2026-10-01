/* Afra Beauty | o espelho de mão da logo, em 3D (Three.js)
   - segue o mouse; no celular, arrasta de lado para girar; um toque faz ele dar uma volta
   - só desenha quando o hero está visível; com "reduzir movimento", fica parado
   - se o WebGL ou o CDN falharem, o pôster (imagem da logo) continua no lugar */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const palco = document.querySelector('[data-espelho]');

function temWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

class Elipse extends THREE.Curve {
  constructor(rx, ry) { super(); this.rx = rx; this.ry = ry; }
  getPoint(t, alvo = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return alvo.set(this.rx * Math.cos(a), this.ry * Math.sin(a), 0);
  }
}

const suave = (t) => 1 - Math.pow(1 - t, 3);
const vaiEVolta = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const corSRGB = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

async function iniciar() {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = matchMedia('(hover: none), (pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, toque ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const tela = renderer.domElement;
  tela.setAttribute('aria-hidden', 'true');
  palco.appendChild(tela);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const chave = new THREE.DirectionalLight(0xfff0e6, 2.2);
  chave.position.set(3, 4, 5);
  const recheio = new THREE.DirectionalLight(0xffd9e0, 0.8);
  recheio.position.set(-4, -1, 3);
  cena.add(chave, recheio, new THREE.AmbientLight(0xffffff, 0.25));

  // ---------- materiais ----------
  const ouro = new THREE.MeshPhysicalMaterial({
    color: 0xe8b75f, metalness: 1, roughness: 0.24,
    clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 1.25,
  });
  const ouroFosco = ouro.clone();
  ouroFosco.roughness = 0.42;

  const textura = await new THREE.TextureLoader().loadAsync('assets/img/marca/espelho-vidro.jpg');
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textura.repeat.set(0.86, 0.86);
  textura.offset.set(0.07, 0.07);

  const vidroMat = new THREE.MeshPhysicalMaterial({
    map: textura, color: 0xffd3cb, emissive: 0xffcfc6, emissiveMap: textura, emissiveIntensity: 0.34,
    roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.55,
  });

  // ---------- o espelho ----------
  const inteiro = new THREE.Group();   // gira em torno do centro do vidro
  const suporte = new THREE.Group();   // inclinação de "segurado na mão" e posição
  suporte.add(inteiro);
  cena.add(suporte);

  const RX = 1, RY = 1.32;
  inteiro.add(new THREE.Mesh(new THREE.TubeGeometry(new Elipse(RX, RY), 220, 0.09, 24, true), ouro));
  inteiro.add(new THREE.Mesh(new THREE.TubeGeometry(new Elipse(0.9, 1.2), 200, 0.026, 12, true), ouro));
  inteiro.add(new THREE.Mesh(new THREE.TubeGeometry(new Elipse(1.13, 1.47), 220, 0.03, 12, true), ouro));

  // pérolas douradas no filete de fora
  const nPerolas = 52;
  const perolas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.046, 14, 10), ouro, nPerolas);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nPerolas; i++) {
    const a = (i / nPerolas) * Math.PI * 2;
    m4.makeTranslation(1.13 * Math.cos(a), 1.47 * Math.sin(a), 0.02);
    perolas.setMatrixAt(i, m4);
  }
  inteiro.add(perolas);

  // arabescos: arcos abertos em volta da moldura (pulando o topo e a base)
  // cada laçada abre para o centro, então as pontas "seguram" a moldura
  const arcoGeo = new THREE.TorusGeometry(0.1, 0.024, 10, 40, Math.PI * 1.35);
  const angulos = [0.3, 0.7, 1.08, 2.06, 2.44, 2.84, 3.44, 3.84, 4.22, 5.2, 5.58, 5.98];
  angulos.forEach((a) => {
    const arco = new THREE.Mesh(arcoGeo, ouro);
    // posição na normal da elipse, logo depois do filete de fora
    const nx = Math.cos(a) / 1.13, ny = Math.sin(a) / 1.47, n = Math.hypot(nx, ny);
    arco.position.set(1.13 * Math.cos(a) + (nx / n) * 0.11, 1.47 * Math.sin(a) + (ny / n) * 0.11, 0);
    arco.rotation.z = Math.atan2(ny, nx) + Math.PI - Math.PI * 0.675;
    inteiro.add(arco);
  });

  // coroa no topo
  const coroa = new THREE.Group();
  const faixa = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 16), ouro);
  faixa.rotation.z = Math.PI / 2;
  coroa.add(faixa);
  [[-0.27, 0.15], [-0.14, 0.24], [0, 0.36], [0.14, 0.24], [0.27, 0.15]].forEach(([x, h]) => {
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 16), ouro);
    ponta.position.set(x, h / 2 + 0.02, 0);
    const gema = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), ouro);
    gema.position.set(x, h + 0.04, 0);
    coroa.add(ponta, gema);
  });
  coroa.position.y = RY + 0.24;
  inteiro.add(coroa);

  // costas do espelho
  const costas = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 96), ouroFosco);
  costas.rotation.x = Math.PI / 2;
  costas.scale.set(1.04, 1, 1.34);
  costas.position.z = -0.07;
  inteiro.add(costas);

  // vidro + reflexo que atravessa
  const vidroGeo = new THREE.CircleGeometry(1, 128);
  vidroGeo.scale(0.92, 1.22, 1);
  const vidro = new THREE.Mesh(vidroGeo, vidroMat);
  vidro.position.z = 0.005;
  inteiro.add(vidro);

  const reflexoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFaixa: { value: -1.5 }, uForca: { value: 0.75 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uFaixa; uniform float uForca; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = (p.x * 0.8 + p.y * 0.6) - uFaixa;
        float banda = exp(-d * d * 26.0) * 0.5 + exp(-pow(d + 0.24, 2.0) * 140.0) * 0.32;
        float borda = smoothstep(1.0, 0.8, length(p));
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9), banda * borda * uForca);
      }`,
  });
  const reflexo = new THREE.Mesh(vidroGeo, reflexoMat);
  reflexo.position.z = 0.02;
  inteiro.add(reflexo);

  // cabo torneado + junta
  const perfil = [
    [0, 0], [0.16, 0], [0.2, -0.06], [0.17, -0.14], [0.1, -0.2], [0.085, -0.35], [0.1, -0.5], [0.13, -0.56],
    [0.1, -0.62], [0.08, -0.8], [0.075, -1.1], [0.085, -1.3], [0.12, -1.42], [0.16, -1.5], [0.13, -1.6],
    [0.06, -1.72], [0, -1.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cabo = new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), ouro);
  cabo.position.y = -1.5;
  const junta = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), ouro);
  junta.position.y = -1.5;
  inteiro.add(cabo, junta);

  // ---------- estrelinhas da logo ----------
  const nEstrelas = toque ? 38 : 64;
  const pos = new Float32Array(nEstrelas * 3);
  const fase = new Float32Array(nEstrelas);
  const tam = new Float32Array(nEstrelas);
  for (let i = 0; i < nEstrelas; i++) {
    // espalhadas em volta do espelho, evitando o centro do vidro
    let x, y;
    do { x = (Math.random() * 2 - 1) * 2.4; y = -2.9 + Math.random() * 5.2; }
    while ((x * x) / 1.6 + ((y - 0.1) * (y - 0.1)) / 2.6 < 1 || (Math.abs(x) < 0.35 && y < -1.4));
    pos.set([x, y, (Math.random() * 2 - 1) * 0.9], i * 3);
    fase[i] = Math.random() * Math.PI * 2;
    tam[i] = 0.5 + Math.random() * 0.9;
  }
  const estrelasGeo = new THREE.BufferGeometry();
  estrelasGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  estrelasGeo.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  estrelasGeo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  const estrelasMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTempo: { value: 0 }, uPixel: { value: 16 * renderer.getPixelRatio() },
      uOpacidade: { value: 0 }, uCor: { value: corSRGB(0xc4923c) },
    },
    vertexShader: /* glsl */`
      uniform float uTempo; uniform float uPixel; uniform float uOpacidade;
      attribute float aFase; attribute float aTam;
      varying float vBrilho;
      void main() {
        vec3 p = position;
        p.y += sin(uTempo * 0.4 + aFase) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float pisca = 0.5 + 0.5 * sin(uTempo * 1.6 + aFase * 6.2831);
        vBrilho = pisca * uOpacidade;
        gl_PointSize = aTam * uPixel * (0.55 + 0.45 * pisca) * (10.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCor; varying float vBrilho;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = length(uv);
        float raios = pow(max(0.0, 1.0 - d), 1.6) * max(0.0, 1.0 - abs(uv.x * uv.y) * 36.0);
        float nucleo = exp(-d * d * 22.0);
        float a = (raios + nucleo * 0.7) * vBrilho;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCor * (0.85 + nucleo * 0.5), min(a, 1.0));
      }`,
  });
  const estrelas = new THREE.Points(estrelasGeo, estrelasMat);
  suporte.add(estrelas);

  // ---------- enquadramento ----------
  const ALTURA = 5.7, LARGURA = 3.9, CENTRO_Y = 0.62;
  function enquadrar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tg = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max((ALTURA / 2) / tg, (LARGURA / 2) / (tg * camera.aspect));
    camera.updateProjectionMatrix();
    estrelasMat.uniforms.uPixel.value = 16 * renderer.getPixelRatio() * Math.min(1.25, h / 520);
    if (!rodando) desenhar(performance.now());
  }

  // ---------- interação ----------
  const alvo = { x: 0, y: 0 };
  const atual = { x: 0, y: 0 };
  let arrastando = false, inicioX = 0, inicioY = 0, inicioRot = 0, inicioT = 0, moveu = false;
  let giroInicio = -1;

  if (!reduzido) {
    if (!toque) {
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        alvo.y = ((e.clientX / innerWidth) * 2 - 1) * 0.55;
        alvo.x = ((e.clientY / innerHeight) * 2 - 1) * 0.18;
      }, { passive: true });
    }
    tela.addEventListener('pointerdown', (e) => {
      arrastando = true; moveu = false;
      inicioX = e.clientX; inicioY = e.clientY; inicioRot = alvo.y; inicioT = performance.now();
    });
    tela.addEventListener('pointermove', (e) => {
      if (!arrastando || e.pointerType === 'mouse') return;
      const dx = e.clientX - inicioX;
      if (Math.abs(dx) > 8) moveu = true;
      alvo.y = limitar(inicioRot + dx * 0.009, -1.1, 1.1);
    });
    const soltar = (e) => {
      if (!arrastando) return;
      arrastando = false;
      const parado = Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < 8;
      if (!moveu && parado && performance.now() - inicioT < 450 && giroInicio < 0) giroInicio = performance.now();
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', () => { arrastando = false; });
  }

  // ---------- quadro a quadro ----------
  const nascimento = performance.now();
  let rodando = false;

  function desenhar(agora) {
    const t = (agora - nascimento) / 1000;
    const entrada = reduzido ? 1 : suave(limitar(t / 1.8, 0, 1));

    // balanço sozinho no celular (não há mouse para seguir)
    if (toque && !arrastando && !reduzido) alvo.y += (Math.sin(t * 0.45) * 0.38 - alvo.y) * 0.02;
    atual.x += (alvo.x - atual.x) * 0.06;
    atual.y += (alvo.y - atual.y) * 0.06;

    let giro = 0;
    if (giroInicio >= 0) {
      const g = (agora - giroInicio) / 1300;
      if (g >= 1) giroInicio = -1; else giro = vaiEVolta(g) * Math.PI * 2;
    }

    // ao rolar a página, o espelho gira um pouco e sobe junto
    const rolagem = reduzido ? 0 : limitar(window.scrollY / Math.max(palco.clientHeight, 1), 0, 1.2);

    const flutua = reduzido ? 0 : Math.sin(t * 0.9) * 0.06;
    inteiro.rotation.set(atual.x, atual.y + giro + (1 - entrada) * -1.4 + rolagem * 0.9, reduzido ? 0 : Math.sin(t * 0.6) * 0.025);
    inteiro.position.y = flutua + (1 - entrada) * -0.5;
    inteiro.scale.setScalar(0.82 + 0.18 * entrada);
    suporte.rotation.z = -0.14;
    suporte.position.y = CENTRO_Y + rolagem * 0.7;

    reflexoMat.uniforms.uFaixa.value = (reduzido ? -0.3 : Math.sin(t * 0.35) * 1.3) + atual.y * 1.4 + (giro ? Math.sin(giro) * 1.2 : 0);
    estrelasMat.uniforms.uTempo.value = reduzido ? 1.2 : t;
    estrelasMat.uniforms.uOpacidade.value = entrada * (giro ? 1.35 : 1);
    estrelas.rotation.y = atual.y * 0.3;

    renderer.render(cena, camera);
  }

  function ligar(sim) {
    if (reduzido) { desenhar(performance.now()); return; }
    if (sim === rodando) return;
    rodando = sim;
    renderer.setAnimationLoop(sim ? desenhar : null);
  }

  new ResizeObserver(enquadrar).observe(palco);
  enquadrar();
  desenhar(performance.now());
  palco.classList.add('hero__palco--pronto');

  let visivel = true;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; ligar(visivel && !document.hidden); }).observe(palco);
  document.addEventListener('visibilitychange', () => ligar(visivel && !document.hidden));
  ligar(true);
}

if (palco && temWebGL()) {
  iniciar().catch((erro) => { console.warn('Espelho 3D desligado:', erro); });
}
