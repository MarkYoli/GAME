;(function(){
  const lang = (document.getElementById('language')?.value || 'russian').toLowerCase()
  const isRu = ['russian','uzbek','azerbaijani'].includes(lang)

  const texts = {
    ru: {
      tips: 'Играйте сериями по 10, не меняя ставку.',
      getSignal: 'Получить сигнал',
      ready: 'Готово',
      cooldown: s=>`Следующий сигнал через ${s}с`,
      history: 'История сигналов',
      best: 'Лучший:', avg: 'Средний:', count: 'Всего:',
      sync: 'СИНХРОНИЗАЦИЯ ДАННЫХ',
      stepInit: 'Инициализация', stepConn:'Подключение', stepAnal:'Анализ', stepRes:'Результат',
      resultTitle: 'СТРОЙКА ПРОСЧИТАНА', close: 'ЗАКРЫТЬ',
      resultText: (n,x,p)=>`Поставьте ${n} блок(ов) и заберите при коэф. x${x}<br>Вероятность: ${p}%`
    },
    en: {
      tips: 'Play in series of 10 without changing the bet.',
      getSignal: 'Get Signal',
      ready: 'Ready',
      cooldown: s=>`Next signal in ${s}s`,
      history: 'Signals History',
      best: 'Best:', avg: 'Average:', count: 'Total:',
      sync: 'DATA SYNCHRONIZATION',
      stepInit:'Initialization', stepConn:'Connection', stepAnal:'Analysis', stepRes:'Result',
      resultTitle: 'BUILD PLAN READY', close: 'CLOSE',
      resultText: (n,x,p)=>`Place ${n} block(s) and cashout at x${x}<br>Probability: ${p}%`
    }
  }
  const T = isRu?texts.ru:texts.en

  // Elements
  const el = id=>document.getElementById(id)
  const tipsText = el('tips-text'); if(tipsText) tipsText.textContent = T.tips
  const signalBtn = el('signal-btn')
  const readyBadge = el('ready-badge'); if(readyBadge) readyBadge.textContent = T.ready
  const cooldownTimer = el('cooldown-timer')
  const historyTitle = document.getElementById('history-title'); if(historyTitle) historyTitle.textContent = T.history
  ;(function syncLabels(){
    const m = new Map([
      ['stat-best-label', T.best],
      ['stat-avg-label', T.avg],
      ['stat-count-label', T.count],
      ['sync-title', T.sync],
      ['step-init', T.stepInit],
      ['step-conn', T.stepConn],
      ['step-anal', T.stepAnal],
      ['step-res', T.stepRes],
      ['result-title', T.resultTitle],
      ['close-result', T.close],
      ['get-signal-text', T.getSignal]
    ])
    m.forEach((v,k)=>{ const n = el(k); if(n){ if(k==='close-result') n.textContent=v; else n.innerHTML=v } })
    // Additional labels
    const lBlocks = el('res-label-blocks'); if(lBlocks) lBlocks.textContent = isRu? 'Блоков' : 'Blocks'
    const lMult = el('res-label-mult'); if(lMult) lMult.textContent = isRu? 'Цель' : 'Target'
    const lProb = el('res-label-prob'); if(lProb) lProb.textContent = isRu? 'Вероятность' : 'Probability'
    const aStatus = document.querySelector('.result-titles .analysis-status');
    if(aStatus) aStatus.textContent = isRu? 'Анализ завершен' : 'Analysis completed'
  })()

  // Stats
  const statBest = el('stat-best')
  const statAvg = el('stat-avg')
  const statCount = el('stat-count')
  const multiplier = el('multiplier')
  const historyList = el('history-list')

  let results = []
  function updateStats(){
    if(results.length===0){ statBest.textContent='x0.00'; statAvg.textContent='x0.00'; statCount.textContent='0'; return }
    const best = Math.max(...results.map(r=>r.x))
    const avg = results.reduce((a,b)=>a+b.x,0)/results.length
    statBest.textContent = 'x'+best.toFixed(2)
    statAvg.textContent = 'x'+avg.toFixed(2)
    statCount.textContent = String(results.length)
  }

  function addHistory(item){
    const li = document.createElement('li')
    li.innerHTML = `<span>${new Date().toLocaleTimeString()}</span><span>x${item.x.toFixed(2)} · ${item.n} ${isRu?'блоков':'blocks'} · ${item.p}%</span>`
    historyList.prepend(li)
    while(historyList.children.length>10) historyList.removeChild(historyList.lastChild)
  }

  // Pseudo signal generation
  function randomBetween(a,b){ return a + Math.random()*(b-a) }
  function chooseX(){
    const r = Math.random()
    if(r<0.50) return randomBetween(3.0, 15.0)
    if(r<0.85) return randomBetween(15.0, 35.0)
    return randomBetween(35.0, 50.0)
  }
  let lastN=-1,lastX=-1
  function generateSignal(){
    let n = Math.floor(randomBetween(5, 20.99))
    let x = chooseX()
    let p = Math.round(randomBetween(92.0,99.8)*10)/10
    // avoid repeats
    if(n===lastN) n = Math.max(5, Math.min(20, n + (Math.random()<0.5?-1:1)))
    if(Math.abs(x-lastX) < 0.1) x += (Math.random()<0.5?-1:1)*randomBetween(0.1,0.3)
    lastN=n; lastX=x
    return {n, x:Math.max(3.0,Math.min(50.0,x)), p: p.toFixed(1)}
  }

  // Cooldown
  let cd=0, cdTimer=null
  function startCooldown(seconds){
    cd = seconds
    cooldownTimer.style.display = 'block'
    signalBtn.disabled = true
    const tick = ()=>{
      cooldownTimer.textContent = T.cooldown(cd)
      cd -= 1
      if(cd<0){
        clearInterval(cdTimer); cdTimer=null
        cooldownTimer.style.display = 'none'
        signalBtn.disabled = false
        return
      }
    }
    tick(); cdTimer = setInterval(tick,1000)
  }

  // Modals
  const analysisModal = document.getElementById('analysis-modal')
  const resultModal = document.getElementById('result-modal')
  const analysisLog = document.getElementById('analysis-log')
  const resultText = document.getElementById('result-text')
  const closeBtn = document.getElementById('close-result')

  function open(el){ el.style.display='flex' }
  function close(el){ el.style.display='none' }

  function stepperAdvance(step){
    const steps = document.querySelectorAll('.step')
    const conns = document.querySelectorAll('.connector')
    steps.forEach((s,i)=>{ if(i<step) s.classList.add('active'); else s.classList.remove('active') })
    conns.forEach((c,i)=>{
      c.classList.remove('filled','loading')
      if(i < step-1) c.classList.add('filled')
      else if(i === step-1) c.classList.add('loading')
    })
  }

  function simulateAnalysis(cb){
    analysisLog.innerHTML = ''
    const bar = document.getElementById('analysis-bar');
    const caption = document.getElementById('step-caption');
    const stepperCaption = document.getElementById('stepper-caption');
    open(analysisModal)
    stepperAdvance(1)
    const stepTitles = isRu
      ? ['Инициализация','Подключение','Анализ','Результат']
      : ['Init','Connect','Analyze','Result']
    const lines = [
      isRu? 'Инициализация модулей...':'Initializing modules...',
      isRu? 'Подключение к 1WIN API...':'Connecting to 1WIN API...',
      isRu? 'Получение последних игр...':'Fetching recent games...',
      isRu? 'Анализ паттернов Tower Rush...':'Analyzing Tower Rush patterns...',
      isRu? 'Оценка вероятностей и рисков...':'Estimating probabilities and risks...',
      isRu? 'Генерация оптимальной серии...':'Generating optimal sequence...'
    ]
    let i=0
    const TYPE_MS = 22; // typing speed per char
    const AFTER_LINE_MS = 350; // pause after each line
    function typeLine(text, done){
      const el = document.createElement('div'); el.className='log-line'; analysisLog.appendChild(el)
      let idx=0
      const timer = setInterval(()=>{
        idx++
        el.textContent = text.slice(0, idx)
        if(idx>=text.length){
          clearInterval(timer)
          done && setTimeout(done, AFTER_LINE_MS)
        }
      }, TYPE_MS)
    }
    function setCaption(idx){
      if(caption){
        caption.classList.remove('show')
        caption.classList.add('enter')
        setTimeout(()=>{
          caption.textContent = stepTitles[idx]
          caption.classList.remove('enter')
          caption.classList.add('show')
        },100)
      }
      // toggle only active step label visible
      const steps = document.querySelectorAll('.step')
      steps.forEach((s,i)=>{
        const lbl = s.querySelector('.label')
        if(lbl){ lbl.style.display = (i===idx)?'inline-block':'none' }
      })
    }

    function next(){
      if(i<lines.length){
        const p = Math.min(95, Math.round(((i+1)/lines.length)*100))
        bar.style.width = p+'%'
        const stepIdx = Math.min(3, Math.floor((i)/2))
        stepperAdvance(stepIdx+1)
        setCaption(stepIdx)
        typeLine(lines[i++], ()=> next())
      } else {
        bar.style.width = '100%'
        stepperAdvance(4); setCaption(3)
        setTimeout(()=>{ close(analysisModal); cb() }, 700)
      }
    }
    next()
  }

  function runSignal(){
    const sig = generateSignal()
    simulateAnalysis(()=>{
      // Fill structured result UI
      const resBlocks = document.getElementById('res-blocks')
      const resMult = document.getElementById('res-mult')
      const resProb = document.getElementById('res-prob')
      const resNote = document.getElementById('result-note')
      resBlocks.textContent = String(sig.n)
      resMult.textContent = 'x'+sig.x.toFixed(2)
      resProb.textContent = sig.p + '%'
      resNote.innerHTML = isRu
        ? `Поставьте ${sig.n} блок(ов) и заберите при коэффициенте <b>x${sig.x.toFixed(2)}</b>.`
        : `Place ${sig.n} blocks and cashout at <b>x${sig.x.toFixed(2)}</b>.`
      open(resultModal)
      // small crane reaction
      const stage = document.querySelector('.crane-stage')
      if(stage){ stage.classList.add('crane-wiggle'); setTimeout(()=>stage.classList.remove('crane-wiggle'), 700) }
      results.unshift({x:sig.x, n:sig.n, p:sig.p})
      updateStats(); addHistory(sig)
      animateMultiplier(sig.x)
      startCooldown(3)
    })
  }

  function animateMultiplier(target){
    const start = performance.now(); const dur = 900
    const init = 1.0
    function frame(now){
      const t = Math.min(1, (now-start)/dur)
      const val = init + (target-init)*t
      multiplier.textContent = 'x'+val.toFixed(2)
      if(t<1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  if(signalBtn){
    signalBtn.addEventListener('click', ()=>{ if(!cdTimer) runSignal() })
  }
  if(closeBtn){ closeBtn.addEventListener('click', ()=> { close(resultModal) }) }

  // Telegram WA
  if(window.Telegram && window.Telegram.WebApp){
    try{ Telegram.WebApp.expand(); window.Telegram.WebApp.allow_vertical_swipe=false; window.Telegram.WebApp.disableVerticalSwipes(); }catch(e){}
  }
})()


