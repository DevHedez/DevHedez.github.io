// script.js - juego de memoria + picker + overlay "noche" con flores que crecen
document.addEventListener('DOMContentLoaded', () => {
  const FLOWERS = ['🌸','🌺','🌼','🌻','💐','🌷','🌹','🥀','🌱','🌿'];

  const PHRASES = [
    "Eres la flor que alegra mis días.",
    "Contigo florece mi corazón.",
    "Tu sonrisa es mi primavera eterna.",
    "Donde estás tú, nace un jardín.",
    "Eres mi pétalo favorito en la tormenta.",
    "Amarte es regar mi alma cada día.",
    "Tu cariño es luz que todo lo ilumina.",
    "Tu risa hace brotar mil flores.",
    // ... (más frases si las necesitas)
  ];

  // DOM
  const board = document.getElementById('board');
  const movesSpan = document.getElementById('moves');
  const matchesSpan = document.getElementById('matches');
  const restartBtn = document.getElementById('restartBtn');
  const flowerPicker = document.getElementById('flowerPicker');
  const phraseText = document.getElementById('phraseText');
  const nightBtn = document.getElementById('nightBtn');
  const nightOverlay = document.getElementById('nightOverlay');
  const closeNight = document.getElementById('closeNight');

  // Protección: overlay oculto al inicio
  try { nightOverlay.hidden = true; nightOverlay.setAttribute('aria-hidden', 'true'); } catch(e){}

  // Pairs ajustable para móvil
  let PAIRS = (window.innerWidth <= 420 || ('ontouchstart' in window && window.innerWidth < 500)) ? 6 : 8;

  // Estado del juego
  let grid = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let moves = 0;
  let matches = 0;

  // Overlay timers
  let growInterval = null;
  let growTimeout = null;

  // Mensajes ocasionales con Swal: ahora con las frases que proporcionaste incluidas
  const MESSAGE_POOL = [
    // tus nuevos mensajes (tal como los enviaste)
    "Demasiados intentos gusano perdedor",
    "levantate y sigue adelante",
    "Fracasar no es una opción",
    // mensaje de victoria agregado
    "¡Victoria! Lo lograste, felicidades",
    // otros mensajes útiles/amistosos
    "MMm ya vas en 5 movimientos, ya hubieras terminado",
    "Uy, vas por buen camino... ¿lo harás en menos?",
    "Ey, eso estuvo cerca, ¡anímate!",
    "Casi, casi... sigue así",
    "¡Qué habilidad! o ¿pura suerte?",
    "No está mal, pero podrías hacerlo mejor 😉",
    "Se puso interesante, mantén la concentración",
    "Ese movimiento fue curioso... 😏",
    "Si sigues así, te quedará fácil"
  ];
  const INTERESTING_THRESHOLDS = [3,4,5,6,7,8,10,12,15];
  const MAX_ALERTS_PER_GAME = 2; // cuántos avisos como máximo por partida
  let alertsShown = 0;
  let shownForMoves = new Set();

  function shuffle(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
    return array;
  }

  function initGame(){
    PAIRS = (window.innerWidth <= 420 || ('ontouchstart' in window && window.innerWidth < 500)) ? 6 : 8;

    const pool = [];
    let i=0;
    while(pool.length < PAIRS){
      pool.push(FLOWERS[i % FLOWERS.length]);
      i++;
    }
    const paired = shuffle([...pool, ...pool]);
    grid = paired;
    board.innerHTML='';
    firstCard = null; secondCard = null; lockBoard=false;
    moves = 0; matches = 0;
    alertsShown = 0;
    shownForMoves.clear();
    updateStats();

    paired.forEach((flower, idx) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.setAttribute('data-flower', flower);
      card.setAttribute('aria-label', 'Carta de flor');
      card.innerHTML = `
        <div class="inner">
          <div class="face back">?</div>
          <div class="face front">${flower}</div>
        </div>
      `;
      const onTap = (e) => {
        try { e.preventDefault(); } catch(_) {}
        onCardClick(card);
      };
      card.addEventListener('click', onTap);
      card.addEventListener('touchstart', onTap, {passive:false});
      board.appendChild(card);
    });
  }

  function maybeShowRandomSwal(movesCount){
    // No más de MAX_ALERTS_PER_GAME por partida
    if(alertsShown >= MAX_ALERTS_PER_GAME) return;

    // Evitar repetir para el mismo número de movimientos
    if(shownForMoves.has(movesCount)) return;

    // Decidir si este movimiento es "interesante": exacto en thresholds o cerca (±1)
    let interesting = false;
    for(const t of INTERESTING_THRESHOLDS){
      if(Math.abs(movesCount - t) <= 1){
        interesting = true;
        break;
      }
    }

    // Base chance y ajuste si es "interesante"
    let baseChance = 0.06; // 6% por defecto
    if(interesting) baseChance = 0.20; // si está cerca de un umbral, más probable (20%)
    // notoriedad extra si es relativamente bajo (sorpresa temprana)
    if(movesCount <= 4) baseChance += 0.03;

    // azar final
    if(Math.random() < baseChance){
      // elegir mensaje aleatorio de MESSAGE_POOL (incluye tus mensajes)
      const msg = MESSAGE_POOL[Math.floor(Math.random()*MESSAGE_POOL.length)];
      if(window.Swal && typeof window.Swal.fire === 'function'){
        // uso básico de Swal: toast para no interrumpir mucho en móvil
        Swal.fire({ text: msg, icon: 'info', toast: true, position: 'top', timer: 2200, showConfirmButton: false });
      } else {
        // fallback simple
        alert(msg);
      }
      alertsShown++;
      shownForMoves.add(movesCount);
    } else {
      // marcar que ya pasó la oportunidad para este movimiento (no volver a intentar)
      shownForMoves.add(movesCount);
    }
  }

  function onCardClick(card){
    if(lockBoard) return;
    if(card === firstCard) return;
    if(card.disabled) return;

    card.classList.add('flipped');

    if(!firstCard){
      firstCard = card;
      return;
    }
    secondCard = card;
    moves++;
    updateStats();

    // Intent creativo: no solo en 5, sino "a veces" en varios conteos
    maybeShowRandomSwal(moves);

    const a = firstCard.getAttribute('data-flower');
    const b = secondCard.getAttribute('data-flower');

    if(a === b){
      firstCard.disabled = true;
      secondCard.disabled = true;
      firstCard = null;
      secondCard = null;
      matches++;
      updateStats();
      if(matches === PAIRS){
        setTimeout(()=> {
          phraseText.textContent = "¡Felicidades! 🌟 Has encontrado todas las parejas.";
          // Mostrar Swal de victoria cuando ganes (solo al ganar)
          if(window.Swal && typeof window.Swal.fire === 'function'){
            Swal.fire({ title: '¡Victoria!', text: 'Lo lograste, felicitaciones 🌟', icon: 'success', confirmButtonText: 'Aceptar' });
          }
        }, 600);
      }
    } else {
      lockBoard = true;
      setTimeout(()=> {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        firstCard = null;
        secondCard = null;
        lockBoard = false;
      }, 700);
    }
  }

  function updateStats(){
    movesSpan.textContent = `Movimientos: ${moves}`;
    matchesSpan.textContent = `Parejas: ${matches}/${PAIRS}`;
  }

  // Picker
  function renderPicker(){
    flowerPicker.innerHTML = '';
    const unique = Array.from(new Set(FLOWERS)).slice(0,8);
    unique.forEach((f)=>{
      const btn = document.createElement('button');
      btn.className = 'picker-item';
      btn.innerText = f;
      btn.setAttribute('aria-label', `Elegir ${f}`);
      btn.addEventListener('click', () => {
        Array.from(flowerPicker.children).forEach(c=>c.classList.remove('selected'));
        btn.classList.add('selected');
        const phrase = PHRASES[Math.floor(Math.random()*PHRASES.length)];
        phraseText.textContent = `${f}  —  ${phrase}`;
      });
      flowerPicker.appendChild(btn);
    });
  }

  // Overlay "Noche" — flores que crecen
  function openNight(){
    clearGrowTimers();
    try {
      nightOverlay.hidden = false;
      nightOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overlay-open');
    } catch(e){}

    // ráfaga de flores que "crecen"
    spawnGrowingFlower();
    growInterval = setInterval(spawnGrowingFlower, 180);
    growTimeout = setTimeout(()=> {
      clearGrowTimers();
    }, 3000);
  }

  function closeNightOverlay(){
    clearGrowTimers();
    try {
      nightOverlay.hidden = true;
      nightOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overlay-open');
    } catch(e){}
    Array.from(nightOverlay.querySelectorAll('.growing-flower')).forEach(el=>el.remove());
  }

  function clearGrowTimers(){
    if(growInterval){ clearInterval(growInterval); growInterval = null; }
    if(growTimeout){ clearTimeout(growTimeout); growTimeout = null; }
  }

  function spawnGrowingFlower(){
    try {
      const emoji = FLOWERS[Math.floor(Math.random()*FLOWERS.length)];
      const el = document.createElement('div');
      el.className = 'growing-flower';
      el.innerText = emoji;

      const leftPct = 10 + Math.random()*80;
      const topPct = 40 + Math.random()*40;
      el.style.left = `${leftPct}vw`;
      el.style.top = `${topPct}vh`;

      const base = 24 + Math.random()*48;
      el.style.fontSize = `${base}px`;

      const rot = Math.random()*40 - 20;
      el.style.transform = `translateY(12vh) rotate(${rot}deg) scale(0.05)`;

      const duration = 2200 + Math.random()*900;
      el.style.animationDuration = `${duration}ms`;

      nightOverlay.appendChild(el);

      el.addEventListener('animationend', ()=> {
        if(el && el.parentNode) el.parentNode.removeChild(el);
      });
    } catch(e){}
  }

  // Eventos
  restartBtn.addEventListener('click', initGame);
  nightBtn.addEventListener('click', () => {
    if(nightOverlay.hidden){
      openNight();
    } else {
      closeNightOverlay();
    }
  });

  closeNight.addEventListener('click', closeNightOverlay);
  closeNight.addEventListener('touchstart', (e)=>{ try{ e.preventDefault(); }catch{} closeNightOverlay(); }, {passive:false});

  nightOverlay.addEventListener('click', (e) => {
    if(e.target === nightOverlay) closeNightOverlay();
  }, {passive:true});

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !nightOverlay.hidden) closeNightOverlay();
  });

  window.addEventListener('resize', () => {
    initGame();
    renderPicker();
  });

  // Inicializar
  renderPicker();
  initGame();
});