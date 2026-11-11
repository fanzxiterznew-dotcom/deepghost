/* ============================================================
   otak.js — DEEPZ AI BRAIN v4.0
   Single-file, zero-API. Fokus: pengetahuan publik dunia
   + generasi kode HTML / JS / CPP / XML.

   Pipeline WAJIB tiap jawaban:
     1. THINKING   — analisis maksud, konteks, entitas, kompleksitas
     2. SEARCH     — penelusuran mendalam ke basis pengetahuan
     3. SYNTHESIS  — susun jawaban / kode
     4. VERIFY     — validasi kualitas sebelum dikirim

   API:
     DeepzAI.ask(q)              -> Promise<result>
     DeepzAI.askSync(q)          -> result
     DeepzAI.think(q)            -> thought object
     DeepzAI.search(q)           -> search result
     DeepzAI.learn.knowledge([]) -> tambah entri
     DeepzAI.learn.synonyms({})  -> tambah sinonim
     DeepzAI.learn.code(lang, [])-> tambah template kode
     DeepzAI.stats()             -> statistik otak
   ============================================================ */
(function (global) {
  'use strict';

  const VERSION = '4.0.0';
  const PIPELINE = ['thinking', 'search', 'synthesis', 'verify'];

  const state = {
    KB:     [],
    SYN:    {},
    CODE:   {},
    MEMORY: [],
    STATS:  { queries: 0, hits: 0, misses: 0, code: 0, math: 0 }
  };

  /* =========================================================
     UTIL
     ========================================================= */
  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const toks = s => norm(s).split(' ').filter(Boolean);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const nowMs = () =>
    (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

  function expand(tokens) {
    const out = new Set(tokens);
    for (const t of tokens) {
      if (state.SYN[t]) state.SYN[t].forEach(x => out.add(x));
      for (const k in state.SYN) {
        if (state.SYN[k].includes(t)) out.add(k);
      }
    }
    return [...out];
  }

  /* =========================================================
     MATH ENGINE
     ========================================================= */
  function tryMath(q) {
    const s = String(q).replace(/,/g, '.').trim();
    if (!/^[\d\s+\-*/().]+$/.test(s)) return null;
    if (!/[\d]/.test(s) || !/[+\-*/]/.test(s)) return null;
    try {
      const r = Function('"use strict";return (' + s + ')')();
      if (typeof r === 'number' && isFinite(r)) return r;
    } catch (e) {}
    return null;
  }

  /* =========================================================
     DETECTION
     ========================================================= */
  function detectLanguage(q) {
    const t = norm(q);
    if (/\bhtml5?\b/.test(t)) return 'html';
    if (/\bjavascript\b|\bjs\b|\bnode\.?js\b/.test(t)) return 'js';
    if (/\bcpp\b|\bc\+\+\b|\bcplusplus\b|\bc plus plus\b/.test(t)) return 'cpp';
    if (/\bxml\b/.test(t)) return 'xml';
    return null;
  }

  function detectSocial(q) {
    const t = norm(q);
    if (/^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum|selamat\s+\w+)\b/.test(t)) return 'greeting';
    if (/^(makasih|terima\s*kasih|thanks|thx)\b/.test(t)) return 'thanks';
    if (/^(bye|sampai\s+jumpa|dadah|goodbye|selamat\s+tinggal)\b/.test(t)) return 'bye';
    if (/kamu\s+siapa|siapa\s+(kamu|anda|kau)|namamu|deepz\s+itu/i.test(t)) return 'identity';
    if (/apa\s+(yang\s+)?bisa|kemampuan|fitur|cara\s+pakai|kegunaan/i.test(t)) return 'capabilities';
    if (/^(tes|test|ping|p)$/.test(t)) return 'ping';
    return null;
  }

  /* =========================================================
     STAGE 1 — THINKING
     ========================================================= */
  function think(query) {
    const raw = String(query || '').trim();
    const t = norm(raw);
    const tokens = toks(raw);
    const expanded = expand(tokens);
    const social = detectSocial(raw);
    const lang = detectLanguage(raw);
    const math = tryMath(raw);

    let complexity = Math.min(tokens.length, 20) * 2;
    if (raw.length > 60) complexity += 10;
    if (raw.includes('?')) complexity += 5;
    if (expanded.length > tokens.length) complexity += 8;

    const hasContext = state.MEMORY.length > 0;
    const lastAi = hasContext
      ? [...state.MEMORY].reverse().find(m => m.role === 'ai')
      : null;

    let intent = 'knowledge';
    if (social) intent = 'social';
    else if (math !== null) intent = 'math';
    else if (lang) intent = 'code';
    else if (tokens.length <= 2) intent = 'short';

    const entities = [];
    if (/\d/.test(raw)) entities.push('numbers');
    if (lang) entities.push('lang:' + lang);
    for (const kw of ['html','js','javascript','cpp','xml','fungsi','loop',
      'class','array','variabel','form','login','tabel','navbar','api',
      'database','ai','sains','sejarah','geografi','kesehatan','ekonomi']) {
      if (t.includes(kw)) entities.push('kw:' + kw);
    }

    let ambiguity = 0;
    if (tokens.length <= 2 && !social && !math) ambiguity += 3;
    if (/^(apa|bagaimana|kenapa|mengapa|gimana|how|what|why)$/.test(t)) ambiguity += 3;
    if (/\b(itu|ini|dia|nya)\b/.test(t) && tokens.length < 6) ambiguity += 2;

    const steps = [
      'Baca query: "' + raw.slice(0, 80) + '"',
      'Token: ' + tokens.length + ' | Expanded: ' + expanded.length,
      'Intent: ' + intent + (social ? ' (' + social + ')' : '') +
        (lang ? ' [' + lang + ']' : ''),
      'Kompleksitas: ' + complexity + ' | Ambiguitas: ' + ambiguity,
      hasContext ? 'Konteks: ' + state.MEMORY.length + ' giliran'
                 : 'Konteks: sesi baru'
    ];

    return {
      raw, normalized: t, tokens, expanded,
      intent, social, language: lang, math,
      complexity, ambiguity, entities,
      context: { hasContext, lastCategory: lastAi ? lastAi.kategori : null },
      steps
    };
  }

  /* =========================================================
     STAGE 2 — SEARCH
     ========================================================= */
  function search(thought) {
    const q = thought.normalized;
    const rawT = thought.tokens;
    const expanded = new Set(thought.expanded);
    const candidates = [];

    for (const entry of state.KB) {
      let score = 0;
      const matched = [];

      for (const p of entry.patterns) {
        try { if (p.test(q)) { score += 120; matched.push('pattern'); } } catch (e) {}
      }

      for (const tag of entry.tags) {
        const nt = norm(tag);
        if (!nt) continue;
        if (q.includes(nt)) { score += 25; matched.push(nt); continue; }
        if (rawT.includes(nt)) { score += 20; matched.push(nt); continue; }
        let hit = false;
        for (const x of expanded) {
          if (x === nt) { score += 18; hit = true; break; }
          if (x.length > 2 && (x.includes(nt) || nt.includes(x))) {
            score += 6; hit = true; break;
          }
        }
        if (hit) matched.push(nt);
      }

      score += (entry.prioritas || 0);

      if (entry.kategori && thought.context.lastCategory === entry.kategori) {
        score += 8;
      }

      if (entry.intent && entry.intent === thought.intent) score += 15;

      if (score > 0) candidates.push({ entry, score, matched });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    const confidence = best ? Math.min(1, best.score / 100) : 0;

    return {
      best, all: candidates.slice(0, 5), confidence,
      totalMatches: candidates.length
    };
  }

  /* =========================================================
     CODE GENERATOR
     ========================================================= */
  function generateCode(lang, query) {
    const q = norm(query);
    const templates = state.CODE[lang] || [];
    if (!templates.length) {
      return {
        answer: 'Belum ada template **' + lang.toUpperCase() + '** di otak saya.',
        source: null
      };
    }

    let best = null, bestScore = 0;
    for (const tpl of templates) {
      let s = 0;
      for (const k of (tpl.keys || [])) {
        if (q.includes(norm(k))) s += 12;
      }
      if (tpl.prioritas) s += tpl.prioritas;
      if (s > bestScore) { bestScore = s; best = tpl; }
    }
    if (!best) best = templates.find(t => t.default) || templates[0];

    const code = typeof best.build === 'function'
      ? best.build(query) : String(best.build || '');

    return {
      answer: 'Berikut kode **' + lang.toUpperCase() + '**:\n\n' +
              '```' + lang + '\n' + code + '\n```\n\n' +
              'Bilang bagian mana yang mau diubah atau ditambah.',
      source: { id: 'code.' + lang, template: best.keys || ['default'], score: bestScore }
    };
  }

  /* =========================================================
     STAGE 3 — SYNTHESIS
     ========================================================= */
  function synthesize(thought, searchResult) {
    const q = thought.raw;

    if (thought.intent === 'math') {
      state.STATS.math++;
      return {
        answer: 'Hasil dari **' + q + '** adalah **' + thought.math + '**.',
        intent: 'math', sources: [], confidence: 0.98
      };
    }

    if (thought.intent === 'code' && thought.language) {
      state.STATS.code++;
      const gen = generateCode(thought.language, q);
      return {
        answer: gen.answer,
        intent: 'code',
        sources: gen.source ? [gen.source] : [],
        confidence: 0.9
      };
    }

    if (thought.intent === 'social') {
      return {
        answer: socialResponse(thought.social, q),
        intent: 'social', sources: [], confidence: 0.95
      };
    }

    if (searchResult.best && searchResult.best.score >= 10) {
      const entry = searchResult.best.entry;
      let ans;
      try {
        ans = typeof entry.jawaban === 'function'
          ? entry.jawaban(q, { memory: state.MEMORY, thought })
          : String(entry.jawaban);
      } catch (e) {
        ans = 'Maaf, ada gangguan saat menyusun jawaban.';
      }
      return {
        answer: ans,
        intent: 'knowledge',
        sources: searchResult.all.map(c => ({
          id: c.entry.id,
          kategori: c.entry.kategori,
          score: c.score,
          matched: c.matched
        })),
        confidence: Math.max(0.5, searchResult.confidence)
      };
    }

    return {
      answer: fallbackResponse(thought),
      intent: 'fallback', sources: [], confidence: 0.2
    };
  }

  /* =========================================================
     SOCIAL
     ========================================================= */
  function socialResponse(kind, q) {
    switch (kind) {
      case 'greeting':
        return 'Halo! Saya **Deepz AI v' + VERSION + '**.\n\n' +
          'Setiap jawaban melewati pipeline: **thinking → search → synthesis → verify**.\n\n' +
          'Saya bisa:\n— Menjawab pengetahuan publik & sehari-hari\n' +
          '— Menghitung matematika\n— Membuat kode HTML / JS / CPP / XML\n\n' +
          'Mau mulai dari mana?';
      case 'thanks':
        return 'Sama-sama! Kalau ada yang mau ditanya atau dibuat lagi, tinggal bilang.';
      case 'bye':
        return 'Sampai jumpa! Semoga harimu lancar.';
      case 'identity':
        return 'Saya **Deepz AI v' + VERSION + '** — otak mandiri, 100% JavaScript, tanpa API.\n\n' +
          'Pipeline wajib 4 tahap: **thinking → search → synthesis → verify**.\n' +
          'Basis pengetahuan saya mencakup geografi, sains, sejarah, teknologi, ' +
          'pemrograman, kesehatan, ekonomi, psikologi, dan banyak lagi.\n\n' +
          'Makin banyak data di `learn.knowledge()`, makin pintar saya.';
      case 'capabilities':
        return 'Kemampuan Deepz AI:\n\n' +
          '1. **Pengetahuan publik** — sains, sejarah, geografi, teknologi, kesehatan, ekonomi, psikologi\n' +
          '2. **Matematika** — hitung ekspresi langsung\n' +
          '3. **Buat kode** — HTML, JS, CPP, XML\n' +
          '4. **Konsep pemrograman** — variabel, fungsi, loop, OOP, algoritma, data struktur\n\n' +
          'Setiap jawaban lewat pipeline berpikir → cari → susun → verifikasi.';
      case 'ping':
        return 'pong · otak aktif · v' + VERSION;
    }
    return 'Halo!';
  }

  function fallbackResponse(thought) {
    let extra = '';
    if (thought.ambiguity >= 3) {
      extra = '\n\n**Saran**: pertanyaanmu cukup singkat. Coba lebih spesifik — ' +
        'contoh: *"apa itu fotosintesis"* daripada cuma *"fotosintesis"*.';
    }
    return 'Saya belum menemukan jawaban pasti di basis pengetahuan.' + extra +
      '\n\nCoba:\n— Tanya lebih spesifik\n' +
      '— Sebut bahasanya kalau minta kode (HTML / JS / CPP / XML)\n' +
      '— Tambah pengetahuan: `DeepzAI.learn.knowledge([...])`';
  }

  /* =========================================================
     STAGE 4 — VERIFY
     ========================================================= */
  function verify(draft, thought) {
    let answer = draft.answer || '';
    let confidence = draft.confidence;
    const notes = [];

    if (!answer.trim()) {
      answer = fallbackResponse(thought);
      confidence = 0.15;
      notes.push('empty → fallback');
    }
    if (thought.intent === 'code' && !/```/.test(answer)) {
      notes.push('code tanpa codeblock');
      confidence = Math.min(confidence, 0.6);
    }
    if (thought.intent === 'math' && !/\d/.test(answer)) {
      notes.push('math tanpa angka');
      confidence = Math.min(confidence, 0.4);
    }
    if (thought.intent === 'knowledge' && answer.length < 20) {
      notes.push('jawaban pendek');
      confidence = Math.min(confidence, 0.5);
    }
    return {
      answer,
      intent: draft.intent,
      sources: draft.sources,
      confidence: Math.round(confidence * 100) / 100,
      notes
    };
  }

  /* =========================================================
     MEMORY
     ========================================================= */
  function remember(role, text, kategori) {
    state.MEMORY.push({ role, text, kategori: kategori || 'umum', time: Date.now() });
    if (state.MEMORY.length > 20) state.MEMORY.shift();
  }

  /* =========================================================
     MAIN PIPELINE
     ========================================================= */
  async function ask(query, opts) {
    opts = opts || {};
    const start = nowMs();
    state.STATS.queries++;
    const trace = [];

    trace.push({ stage: 'thinking', status: 'start', t: 0 });
    const thought = think(query);
    trace.push({ stage: 'thinking', status: 'done',
      t: Math.round(nowMs() - start), detail: thought.steps });

    if (opts.delay) await sleep(opts.delay);

    trace.push({ stage: 'search', status: 'start', t: Math.round(nowMs() - start) });
    const sr = search(thought);
    trace.push({ stage: 'search', status: 'done', t: Math.round(nowMs() - start),
      detail: {
        totalMatches: sr.totalMatches,
        confidence: Math.round(sr.confidence * 100) / 100,
        top: sr.all.map(c => ({ id: c.entry.id, score: c.score }))
      }});

    if (opts.delay) await sleep(opts.delay);

    trace.push({ stage: 'synthesis', status: 'start', t: Math.round(nowMs() - start) });
    const draft = synthesize(thought, sr);
    trace.push({ stage: 'synthesis', status: 'done', t: Math.round(nowMs() - start),
      detail: { intent: draft.intent, length: draft.answer.length }});

    if (opts.delay) await sleep(opts.delay);

    trace.push({ stage: 'verify', status: 'start', t: Math.round(nowMs() - start) });
    const final = verify(draft, thought);
    trace.push({ stage: 'verify', status: 'done', t: Math.round(nowMs() - start),
      detail: { confidence: final.confidence, notes: final.notes }});

    remember('user', query, final.intent);
    remember('ai', final.answer, final.intent);

    if (final.intent === 'fallback') state.STATS.misses++;
    else state.STATS.hits++;

    return {
      query, answer: final.answer, intent: final.intent,
      confidence: final.confidence, sources: final.sources, notes: final.notes,
      thinking: trace, elapsed: Math.round(nowMs() - start), version: VERSION
    };
  }

  function askSync(query) {
    const start = nowMs();
    state.STATS.queries++;
    const thought = think(query);
    const sr = search(thought);
    const draft = synthesize(thought, sr);
    const final = verify(draft, thought);
    remember('user', query, final.intent);
    remember('ai', final.answer, final.intent);
    if (final.intent === 'fallback') state.STATS.misses++;
    else state.STATS.hits++;
    return {
      query, answer: final.answer, intent: final.intent,
      confidence: final.confidence, sources: final.sources, notes: final.notes,
      elapsed: Math.round(nowMs() - start), version: VERSION
    };
  }

  /* =========================================================
     LEARN
     ========================================================= */
  function learnKnowledge(arr) {
    if (!Array.isArray(arr)) return 0;
    let added = 0;
    for (const e of arr) {
      if (!e || !e.id || e.jawaban === undefined) continue;
      if (state.KB.some(x => x.id === e.id)) continue;
      state.KB.push({
        id: e.id,
        kategori: e.kategori || 'umum',
        tags: e.tags || [],
        patterns: e.patterns || [],
        prioritas: e.prioritas || 0,
        intent: e.intent || null,
        jawaban: e.jawaban
      });
      added++;
    }
    return added;
  }

  function learnSynonyms(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    let added = 0;
    for (const k in obj) {
      const key = norm(k);
      const vals = Array.isArray(obj[k]) ? obj[k].map(norm) : [norm(obj[k])];
      state.SYN[key] = state.SYN[key] || [];
      for (const v of vals) {
        if (!state.SYN[key].includes(v)) { state.SYN[key].push(v); added++; }
      }
    }
    return added;
  }

  function learnCode(lang, templates) {
    if (!Array.isArray(templates)) return 0;
    const key = norm(lang);
    state.CODE[key] = state.CODE[key] || [];
    state.CODE[key].push(...templates);
    return state.CODE[key].length;
  }

  /* =========================================================
     STATS
     ========================================================= */
  function stats() {
    const cats = {};
    for (const e of state.KB) cats[e.kategori] = (cats[e.kategori] || 0) + 1;
    return {
      version: VERSION, pipeline: PIPELINE,
      entries: state.KB.length,
      synonyms: Object.keys(state.SYN).length,
      codeLanguages: Object.keys(state.CODE),
      codeTemplates: Object.values(state.CODE).reduce((a, b) => a + b.length, 0),
      categories: cats,
      memorySize: state.MEMORY.length,
      queries: state.STATS.queries,
      hits: state.STATS.hits,
      misses: state.STATS.misses
    };
  }

  /* =========================================================
     ============ SINONIM ============
     ========================================================= */
  learnSynonyms({
    'hai':        ['halo','hi','hello','hei','pagi','siang','sore','malam'],
    'buat':       ['buatkan','bikin','bikinkan','tulis','tuliskan','generate','contoh','coding','program'],
    'kode':       ['coding','program','source','script','syntax','koding'],
    'html':       ['html5','markup','halaman'],
    'js':         ['javascript','node','ecmascript'],
    'cpp':        ['c++','cplusplus','c plus plus'],
    'xml':        ['extensible'],
    'fungsi':     ['function','method','prosedur'],
    'kelas':      ['class','oop','objek'],
    'perulangan': ['loop','for','while','foreach','iterasi'],
    'array':      ['list','larik'],
    'variabel':   ['variable'],
    'form':       ['formulir','login','input','pendaftaran','signin'],
    'tabel':      ['table','grid'],
    'waktu':      ['jam','tanggal','hari','sekarang','pukul'],
    'tidur':      ['istirahat','insomnia','begadang','ngantuk'],
    'sehat':      ['kesehatan','olahraga','diet','vitamin','gizi'],
    'belajar':    ['sekolah','kuliah','ujian','pendidikan','study'],
    'komputer':   ['laptop','pc','cpu','ram','gpu','prosesor'],
    'internet':   ['wifi','jaringan','online','web'],
    'motivasi':   ['semangat','sedih','malas','stress','stres','cemas'],
    'ai':         ['kecerdasan','buatan','artificial','intelligence','ml','machine'],
    'uang':       ['finansial','keuangan','investasi','tabungan','budget'],
    'dunia':      ['bumi','global','internasional'],
    'presiden':   ['kepala','negara','pemimpin'],
    'sejarah':    ['history','masa','lalu','kuno'],
    'perang':     ['war','konflik','pertempuran'],
    'agama':      ['religi','ibadah','kepercayaan']
  });

  /* =========================================================
     ============ PENGETAHUAN PUBLIK ============
     ========================================================= */

  /* ---------- WAKTU & UMUM ---------- */
  learnKnowledge([
    { id:'umum.time', kategori:'waktu',
      tags:['jam','waktu','tanggal','hari','sekarang','pukul'],
      patterns:[/jam\s+berapa|tanggal\s+berapa|hari\s+apa|waktu\s+sekarang|pukul\s+berapa/i],
      jawaban:()=>{
        const d=new Date();
        return 'Sekarang: **'+d.toLocaleString('id-ID',{
          weekday:'long',day:'numeric',month:'long',
          year:'numeric',hour:'2-digit',minute:'2-digit'
        })+'** (waktu lokal perangkatmu).';
      }
    },
    { id:'umum.year', kategori:'waktu',
      tags:['tahun','sekarang','berapa'],
      patterns:[/tahun\s+berapa\s+sekarang/i],
      jawaban:()=>'Sekarang tahun **'+new Date().getFullYear()+'**.'
    }
  ]);

  /* ---------- GEOGRAFI ---------- */
  learnKnowledge([
    { id:'geo.indonesia', kategori:'geografi',
      tags:['indonesia','nusantara','jakarta','pulau'],
      patterns:[/ibu\s*kota\s+indonesia|tentang\s+indonesia|indonesia\s+itu/i],
      jawaban:()=>'Indonesia = negara kepulauan terbesar di dunia, Asia Tenggara, ±17.000 pulau. Ibu kota: Jakarta (Nusantara sedang dikembangkan di Kalimantan Timur sebagai ibu kota baru). Penduduk ±275 juta, mayoritas Muslim. Bahasa: Indonesia. Mata uang: Rupiah.'
    },
    { id:'geo.asean', kategori:'geografi',
      tags:['asean','asia','tenggara'],
      patterns:[/apa\s+itu\s+asean|asean\s+itu/i],
      jawaban:()=>'ASEAN (Association of Southeast Asian Nations) = organisasi regional Asia Tenggara, berdiri 8 Agustus 1967 di Bangkok. 10 anggota: Indonesia, Malaysia, Singapura, Thailand, Filipina, Brunei, Vietnam, Laos, Myanmar, Kamboja.'
    },
    { id:'geo.benua', kategori:'geografi',
      tags:['benua','continent','dunia'],
      patterns:[/apa\s+saja\s+benua|berapa\s+benua|7\s+benua/i],
      jawaban:()=>'7 benua di Bumi: **Asia** (terluas & terpadat), **Afrika** (terbanyak negaranya), **Amerika Utara**, **Amerika Selatan**, **Antartika** (terdingin), **Eropa**, **Australia/Oseania** (terkecil).'
    },
    { id:'geo.samudra', kategori:'geografi',
      tags:['samudra','laut','osean'],
      patterns:[/samudra\s+terluas|laut\s+terluas|berapa\s+samudra/i],
      jawaban:()=>'5 samudra: **Pasifik** (terluas & terdalam, palung Mariana), **Atlantik**, **Hindia**, **Arktik** (terkecil), **Antartika/Selatan**.'
    },
    { id:'geo.gunung.tinggi', kategori:'geografi',
      tags:['gunung','tertinggi','everest'],
      patterns:[/gunung\s+tertinggi|everest/i],
      jawaban:()=>'Gunung tertinggi di dunia: **Everest** (8.849 m, Himalaya, perbatasan Nepal–Tiongkok). Di Indonesia: **Puncak Jaya** (4.884 m, Papua). Gunung berapi tertinggi: **Ojos del Salado** (6.893 m, Chili–Argentina).'
    },
    { id:'geo.sungai', kategori:'geografi',
      tags:['sungai','terpanjang','nil','amazon'],
      patterns:[/sungai\s+terpanjang/i],
      jawaban:()=>'Sungai terpanjang: **Nil** (±6.650 km, Afrika) — kadang diperdebatkan dengan **Amazon** (±6.400 km). Amazon = sungai dengan debit air terbesar di dunia.'
    },
    { id:'geo.pulau.besar', kategori:'geografi',
      tags:['pulau','terbesar','greenland'],
      patterns:[/pulau\s+terbesar/i],
      jawaban:()=>'Pulau terbesar: **Greenland** (2,16 juta km²), lalu **Nugini** (Papua), **Kalimantan** (Borneo), **Sumatra**, **Sulawesi** — 3 di antaranya milik Indonesia.'
    },
    { id:'geo.negara.luas', kategori:'geografi',
      tags:['negara','terluas','russia'],
      patterns:[/negara\s+terluas|negara\s+terbesar/i],
      jawaban:()=>'Negara terluas: **Rusia** (17 juta km², membentang 11 zona waktu). Lalu Kanada, Tiongkok, AS, Brasil. Indonesia peringkat 14–15 (±1,9 juta km²).'
    },
    { id:'geo.negara.padat', kategori:'geografi',
      tags:['terpadat','penduduk','india','china'],
      patterns:[/negara\s+terpadat|penduduk\s+terbanyak/i],
      jawaban:()=>'Negara terpadat: **India** (menyalip Tiongkok sejak 2023), lalu Tiongkok, AS, Indonesia (ke-4), Pakistan.'
    },
    { id:'geo.ibu.kota', kategori:'geografi',
      tags:['ibu kota','capital','negara'],
      patterns:[/ibu\s*kota\s+(amerika|as|jepang|inggris|prancis|china|tiongkok|rusia|brasil|australia|india|korea)/i],
      jawaban:(q)=>{
        const t=norm(q);
        const map={
          'amerika':'Washington D.C. (AS)',
          'as':'Washington D.C. (AS)',
          'jepang':'Tokyo',
          'inggris':'London',
          'prancis':'Paris',
          'china':'Beijing',
          'tiongkok':'Beijing',
          'rusia':'Moscow',
          'brasil':'Brasília',
          'australia':'Canberra',
          'india':'New Delhi',
          'korea':'Seoul (Korea Selatan)'
        };
        for(const k in map){if(t.includes(k))return 'Ibu kota '+map[k]+'.';}
        return 'Ibu kota Indonesia: Jakarta. Yang lain sebutkan negaranya.';
      }
    },
    { id:'geo.indonesia.provinsi', kategori:'geografi',
      tags:['provinsi','indonesia','34','38'],
      patterns:[/berapa\s+provinsi\s+indonesia|provinsi\s+indonesia/i],
      jawaban:()=>'Indonesia punya **38 provinsi** (setelah pemekaran Papua Barat Daya, Papua Tengah, Papua Selatan, Papua Pegunungan pada 2022). Sebelumnya 34.'
    },
    { id:'geo.bumi.keliling', kategori:'geografi',
      tags:['bumi','keliling','diameter','jari'],
      patterns:[/keliling\s+bumi|diameter\s+bumi|ukuran\s+bumi/i],
      jawaban:()=>'Bumi: diameter **±12.742 km** (khatulistiwa), keliling **±40.075 km**, jari-jari rata-rata 6.371 km. Massa ±5,97 × 10²⁴ kg.'
    }
  ]);

  /* ---------- SEJARAH ---------- */
  learnKnowledge([
    { id:'sej.proklamasi', kategori:'sejarah',
      tags:['proklamasi','kemerdekaan','1945','indonesia'],
      patterns:[/proklamasi|kemerdekaan\s+indonesia|17\s+agustus\s+1945/i],
      jawaban:()=>'Proklamasi Kemerdekaan Indonesia dibacakan **17 Agustus 1945** oleh Soekarno (didampingi Hatta) di Jl. Pegangsaan Timur 56, Jakarta. Naskah disusun Soekarno–Hatta–Ahmad Soebardjo, diketik Sayuti Melik. Bendera dijahit Fatmawati.'
    },
    { id:'sej.soekarno', kategori:'sejarah',
      tags:['soekarno','presiden','pertama','indonesia'],
      patterns:[/siapa\s+soekarno|tentang\s+soekarno/i],
      jawaban:()=>'**Soekarno** (1901–1970) = Presiden pertama RI, proklamator kemerdekaan, penggali Pancasila. Bersama Hatta memimpin perjuangan diplomasi. Dikenal orator ulung, presiden seumur hidup 1963–1966, wafat 1970.'
    },
    { id:'sej.hatta', kategori:'sejarah',
      tags:['hatta','wakil','presiden','proklamator'],
      patterns:[/siapa\s+hatta|tentang\s+hatta/i],
      jawaban:()=>'**Mohammad Hatta** (1902–1980) = Wakil Presiden pertama RI, proklamator, ekonom. Dijuluki "Bapak Koperasi". Peran penting dalam perjanjian Linggarjati, Renville, dan KMB 1949.'
    },
    { id:'sej.pd1', kategori:'sejarah',
      tags:['perang','dunia','pertama','ww1','1914'],
      patterns:[/perang\s+dunia\s+1|wwi|pd1|perang\s+dunia\s+pertama/i],
      jawaban:()=>'**Perang Dunia I (1914–1918)** = konflik antara Sekutu (Inggris, Prancis, Rusia, AS masuk 1917) vs Blok Sentral (Jerman, Austria-Hongaria, Ottoman). Pemicu: pembunuhan Franz Ferdinand di Sarajevo. Berakhir dengan Perjanjian Versailles 1919.'
    },
    { id:'sej.pd2', kategori:'sejarah',
      tags:['perang','dunia','kedua','ww2','1939','hitler'],
      patterns:[/perang\s+dunia\s+2|wwii|pd2|perang\s+dunia\s+kedua/i],
      jawaban:()=>'**Perang Dunia II (1939–1945)** = konflik terbesar sepanjang sejarah. Blok Axis (Jerman Nazi, Italia, Jepang) vs Sekutu (Inggris, Uni Soviet, AS, Tiongkok, dll). Pemicu: invasi Jerman ke Polandia. Berakhir dengan bom atom Hiroshima–Nagasaki. Korban ±70 juta jiwa.'
    },
    { id:'sej.hiroshima', kategori:'sejarah',
      tags:['hiroshima','nagasaki','bom','atom','1945'],
      patterns:[/hiroshima|nagasaki|bom\s+atom/i],
      jawaban:()=>'Bom atom **Hiroshima (6 Agustus 1945)** dan **Nagasaki (9 Agustus 1945)** dijatuhkan AS. Menewaskan ±200.000 jiwa langsung. Menjadi pemicu menyerahnya Jepang dan berakhirnya PD II. Satu-satunya penggunaan senjata nuklir dalam perang.'
    },
    { id:'sej.romawi', kategori:'sejarah',
      tags:['romawi','roma','kekaisaran','caesar'],
      patterns:[/romawi|kekaisaran\s+roma|julius\s+caesar/i],
      jawaban:()=>'**Romawi Kuno** berawal sebagai kerajaan (753 SM), republik (509 SM), lalu kekaisaran (27 SM – 476 M di Barat, 1453 M di Timur/Byzantium). Puncak kejayaan: Trajan (117 M). Mewariskan hukum, arsitektur, bahasa Latin, dan sistem pemerintahan.'
    },
    { id:'sej.mesir', kategori:'sejarah',
      tags:['mesir','piramida','firaun','kuno'],
      patterns:[/mesir\s+kuno|piramida|firaun/i],
      jawaban:()=>'**Mesir Kuno** (3100 SM – 30 SM) = peradaban di Sungai Nil. Terkenal karena piramida (Giza ±2560 SM), Firaun, hieroglif, dan mumi. Berakhir saat dikuasai Romawi (Cleopatra VII, 30 SM).'
    },
    { id:'sej.revolusi.industri', kategori:'sejarah',
      tags:['revolusi','industri','mesin','uap'],
      patterns:[/revolusi\s+industri/i],
      jawaban:()=>'**Revolusi Industri** dimulai di Inggris (±1760) dengan mesin uap James Watt. Mengubah ekonomi agraris jadi industri. Gelombang 2 (listrik, 1870), gelombang 3 (komputer, 1970), gelombang 4 (AI & IoT, sekarang).'
    },
    { id:'sej.kolonial', kategori:'sejarah',
      tags:['kolonial','penjajahan','belanda','portugis'],
      patterns:[/kolonialisme|penjajahan|belanda\s+menjajah/i],
      jawaban:()=>'Indonesia dijajah Portugis (1512, Maluku), lalu Belanda via VOC (1602), lalu Hindia Belanda (1800). Jepang menduduki 1942–1945. Merdeka 17 Agustus 1945 setelah ±350 tahun penjajahan.'
    }
  ]);

  /* ---------- SAINS - FISIKA ---------- */
  learnKnowledge([
    { id:'fis.gravitasi', kategori:'sains',
      tags:['gravitasi','gaya','berat','tarik','newton'],
      patterns:[/gravitasi|gaya\s+tarik|kenapa\s+jatuh/i],
      jawaban:()=>'**Gravitasi** = gaya tarik antara massa. Di Bumi percepatannya **g = 9,8 m/s²**. Rumus Newton: **F = G·m₁·m₂/r²**. Einstein (relativitas umum) menjelaskan gravitasi sebagai kelengkungan ruang-waktu akibat massa.'
    },
    { id:'fis.cahaya', kategori:'sains',
      tags:['cahaya','kecepatan','c','300'],
      patterns:[/kecepatan\s+cahaya|berapa\s+cepat\s+cahaya/i],
      jawaban:()=>'Kecepatan cahaya di ruang hampa: **c = 299.792.458 m/s ≈ 3 × 10⁸ m/s**. Ini batas kecepatan kosmik — tidak ada informasi/massa yang bisa melebihi c.'
    },
    { id:'fis.energi', kategori:'sains',
      tags:['energi','kinetik','potensial','joule'],
      patterns:[/apa\s+itu\s+energi|energi\s+itu/i],
      jawaban:()=>'**Energi** = kemampuan melakukan kerja. Bentuk: kinetik (½mv²), potensial (mgh), kimia, listrik, panas, nuklir. **Hukum kekekalan energi**: energi tidak bisa diciptakan/dimusnahkan, hanya berubah bentuk.'
    },
    { id:'fis.listrik', kategori:'sains',
      tags:['listrik','volt','ampere','ohm'],
      patterns:[/apa\s+itu\s+listrik|hukum\s+ohm/i],
      jawaban:()=>'**Listrik** = aliran muatan (elektron). Rumus **Hukum Ohm: V = I·R** (Volt = Ampere × Ohm). Daya: **P = V·I**. Satuan: volt, ampere, ohm, watt.'
    },
    { id:'fis.newton', kategori:'sains',
      tags:['newton','hukum','gerak','inersia'],
      patterns:[/hukum\s+newton/i],
      jawaban:()=>'**3 Hukum Newton:**\n1. **Inersia** — benda diam/bergerak tetap jika tak ada gaya\n2. **F = m·a** — gaya = massa × percepatan\n3. **Aksi-reaksi** — setiap aksi ada reaksi sama besar berlawanan'
    },
    { id:'fis.einstein', kategori:'sains',
      tags:['einstein','relativitas','e=mc'],
      patterns:[/relativitas|einstein|e\s*=\s*mc/i],
      jawaban:()=>'**Relativitas Einstein**:\n— Khusus (1905): waktu & ruang relatif terhadap pengamat; **E = mc²**\n— Umum (1915): gravitasi = kelengkungan ruang-waktu\n\nTerbukti lewat: dilatasi waktu, GPS, gelombang gravitasi (LIGO 2015).'
    },
    { id:'fis.atom', kategori:'sains',
      tags:['atom','proton','neutron','elektron'],
      patterns:[/apa\s+itu\s+atom|struktur\s+atom/i],
      jawaban:()=>'**Atom** = unit terkecil materi. Terdiri dari **inti** (proton + neutron) dan **elektron** yang mengorbit. Proton positif, neutron netral, elektron negatif. Diameter atom ±10⁻¹⁰ m, inti ±10⁻¹⁵ m.'
    }
  ]);

  /* ---------- SAINS - BIOLOGI ---------- */
  learnKnowledge([
    { id:'bio.sel', kategori:'sains',
      tags:['sel','cell','biologi','membran'],
      patterns:[/apa\s+itu\s+sel|sel\s+itu/i],
      jawaban:()=>'**Sel** = unit terkecil kehidupan. Punya membran, sitoplasma, DNA, ribosom. Prokariot (bakteri, tanpa inti) vs eukariot (hewan, tumbuhan, jamur — berinti). Manusia ±37 triliun sel.'
    },
    { id:'bio.dna', kategori:'sains',
      tags:['dna','gen','genetik','kromosom'],
      patterns:[/apa\s+itu\s+dna|dna\s+itu/i],
      jawaban:()=>'**DNA** = molekul pembawa informasi genetik, berbentuk double helix. Tersusun dari 4 basa: **A, T, G, C**. Gen = segmen DNA yang mengkode protein. Manusia punya ±20.000 gen dalam 46 kromosom.'
    },
    { id:'bio.fotosintesis', kategori:'sains',
      tags:['fotosintesis','tumbuhan','daun','klorofil','oksigen'],
      patterns:[/fotosintesis/i],
      jawaban:()=>'**Fotosintesis** = tumbuhan mengubah CO₂ + H₂O + cahaya → glukosa + O₂. Terjadi di kloroplas (daun), pigmen klorofil. Rumus: **6CO₂ + 6H₂O + cahaya → C₆H₁₂O₆ + 6O₂**. Sumber utama oksigen atmosfer.'
    },
    { id:'bio.evolusi', kategori:'sains',
      tags:['evolusi','darwin','seleksi','alam'],
      patterns:[/evolusi|darwin|seleksi\s+alam/i],
      jawaban:()=>'**Evolusi** = perubahan frekuensi gen dalam populasi dari generasi ke generasi. Teori Darwin (1859): seleksi alam — individu dengan sifat menguntungkan lebih bertahan & bereproduksi. Bukti: fosil, DNA, homologi anatomi.'
    },
    { id:'bio.jantung', kategori:'sains',
      tags:['jantung','darah','pompa','detak'],
      patterns:[/apa\s+fungsi\s+jantung|jantung\s+itu|detak\s+jantung/i],
      jawaban:()=>'**Jantung** = pompa otot berukuran ±kepalan tangan, 4 ruang (2 serambi + 2 bilik). Memompa darah ke seluruh tubuh. Detak normal 60–100/menit. Memompa ±5 liter/menit saat istirahat.'
    },
    { id:'bio.otak', kategori:'sains',
      tags:['otak','brain','neuron','saraf'],
      patterns:[/apa\s+itu\s+otak|otak\s+itu|fungsi\s+otak/i],
      jawaban:()=>'**Otak** = pusat sistem saraf, ±86 miliar neuron. Bagian: **cerebrum** (berpikir, memori), **cerebellum** (keseimbangan), **batang otak** (fungsi vital). Konsumsi ±20% energi tubuh walau 2% massa.'
    },
    { id:'bio.darah', kategori:'sains',
      tags:['darah','sel','merah','putih','golongan'],
      patterns:[/golongan\s+darah|apa\s+itu\s+darah|sel\s+darah/i],
      jawaban:()=>'**Darah** = jaringan cair pengangkut O₂, nutrisi, hormon. Komponen: plasma (55%), sel darah merah/eritrosit (pembawa O₂ via hemoglobin), sel darah putih (imun), trombosit (pembekuan). Golongan: A, B, AB, O (+ rhesus ±).'
    },
    { id:'bio.virus', kategori:'sains',
      tags:['virus','covid','flu','infeksi'],
      patterns:[/apa\s+itu\s+virus|virus\s+itu/i],
      jawaban:()=>'**Virus** = partikel infeksius (bukan sel hidup sejati) — DNA/RNA dibungkus protein. Butuh inang untuk bereproduksi. Contoh: influenza, HIV, SARS-CoV-2. Antibiotik tidak bekerja pada virus; gunakan antivirus/vaksin.'
    },
    { id:'bio.bakteri', kategori:'sains',
      tags:['bakteri','mikroba','prokariot'],
      patterns:[/apa\s+itu\s+bakteri|bakteri\s+itu/i],
      jawaban:()=>'**Bakteri** = mikroorganisme prokariot (tanpa inti), berukuran ±1 μm. Ada yang menguntungkan (Lactobacillus untuk yoghurt, flora usus) dan patogen (TB, kolera). Berkembang biak dengan pembelahan biner.'
    },
    { id:'bio.ekosistem', kategori:'sains',
      tags:['ekosistem','rantai','makanan','bioma'],
      patterns:[/ekosistem|rantai\s+makanan/i],
      jawaban:()=>'**Ekosistem** = interaksi makhluk hidup dengan lingkungannya. Komponen biotik (produsen, konsumen, pengurai) & abiotik (air, tanah, cahaya). Rantai makanan: rumput → belalang → katak → ular → elang.'
    }
  ]);

  /* ---------- ASTRONOMI ---------- */
  learnKnowledge([
    { id:'ast.tata.surya', kategori:'astronomi',
      tags:['tata','surya','planet','matahari'],
      patterns:[/tata\s+surya|planet\s+apa\s+saja/i],
      jawaban:()=>'**Tata Surya**: 8 planet mengelilingi Matahari — **Merkurius, Venus, Bumi, Mars** (terestrial), **Jupiter, Saturnus, Uranus, Neptunus** (raksasa gas/es). Plus planet kerdil (Pluto, Ceres), asteroid, komet. Usia ±4,6 miliar tahun.'
    },
    { id:'ast.matahari', kategori:'astronomi',
      tags:['matahari','sun','bintang'],
      patterns:[/apa\s+itu\s+matahari|matahari\s+itu/i],
      jawaban:()=>'**Matahari** = bintang tipe G (katai kuning) di pusat Tata Surya. Massa ±99,86% massa Tata Surya. Suhu permukaan ±5.500°C, inti ±15 juta°C. Fusi nuklir hidrogen → helium. Usia ±4,6 miliar tahun.'
    },
    { id:'ast.bulan', kategori:'astronomi',
      tags:['bulan','moon','satelit','lunar'],
      patterns:[/apa\s+itu\s+bulan|bulan\s+itu|jarak\s+bulan/i],
      jawaban:()=>'**Bulan** = satelit alami Bumi, jarak ±384.400 km. Diameter 3.474 km (¼ Bumi). Terkunci pasang surut — sisi sama selalu menghadap Bumi. Tanpa atmosfer, suhu ekstrem. 12 manusia pernah menginjaknya (Apollo, 1969–1972).'
    },
    { id:'ast.mars', kategori:'astronomi',
      tags:['mars','planet','merah'],
      patterns:[/planet\s+mars|mars\s+itu/i],
      jawaban:()=>'**Mars** = planet ke-4, dijuluki "Planet Merah" (oksida besi). Diameter 6.779 km, atmosfer tipis CO₂. Punya Olympus Mons (gunung tertinggi Tata Surya, ±22 km). Target utama eksplorasi manusia.'
    },
    { id:'ast.jupiter', kategori:'astronomi',
      tags:['jupiter','planet','terbesar'],
      patterns:[/planet\s+jupiter|jupiter\s+itu/i],
      jawaban:()=>'**Jupiter** = planet terbesar, diameter 139.820 km, massa 318× Bumi. Atmosfer hidrogen-helium. Bintik Merah Raksasa = badai berusia >350 tahun. Punya ±95 bulan (Europa, Ganymede, Io, Callisto terbesar).'
    },
    { id:'ast.bintang', kategori:'astronomi',
      tags:['bintang','star','galaksi','nova'],
      patterns:[/apa\s+itu\s+bintang|bintang\s+itu/i],
      jawaban:()=>'**Bintang** = bola gas (hidrogen + helium) yang memancarkan cahaya lewat fusi nuklir. Terbentuk dari nebula, hidup miliaran tahun. Mati sebagai katai putih (kecil) atau ledakan supernova → lubang hitam (besar).'
    },
    { id:'ast.galaksi', kategori:'astronomi',
      tags:['galaksi','bima','sakti','milky','andromeda'],
      patterns:[/galaksi|bima\s+sakti|milky\s+way/i],
      jawaban:()=>'**Galaksi** = kumpulan miliaran bintang, gas, debu, materi gelap yang terikat gravitasi. Kita di **Bima Sakti** (Milky Way, ±100.000 tahun cahaya, 100–400 miliar bintang). Tetangga: Andromeda (menabrak Bima Sakti dalam ±4,5 miliar tahun).'
    },
    { id:'ast.blackhole', kategori:'astronomi',
      tags:['black','hole','lubang','hitam','singularitas'],
      patterns:[/black\s*hole|lubang\s+hitam/i],
      jawaban:()=>'**Lubang hitam** = wilayah ruang-waktu dengan gravitasi sangat kuat sehingga cahaya tidak bisa lolos. Terbentuk dari keruntuhan bintang masif. **Event horizon** = batas titik tak kembali. Yang pertama difoto: M87* (2019).'
    },
    { id:'ast.bigbang', kategori:'astronomi',
      tags:['big','bang','ledakan','awal','alam'],
      patterns:[/big\s*bang|asal\s+usul\s+alam|awal\s+alam\s+semesta/i],
      jawaban:()=>'**Big Bang** = model asal usul alam semesta. ±13,8 miliar tahun lalu, semua materi & energi terpusat dalam titik sangat panas & padat, lalu mengembang. Bukti: pengembangan alam semesta (Hubble), CMB (radiasi latar), kelimpahan unsur ringan.'
    }
  ]);

  /* ---------- SEJARAH - TEKNOLOGI ---------- */
  learnKnowledge([
    { id:'tek.komputer', kategori:'teknologi',
      tags:['komputer','laptop','pc','cpu','ram','gpu','prosesor'],
      patterns:[/apa\s+itu\s+komputer|komponen\s+komputer/i],
      jawaban:()=>'**Komponen inti komputer:**\n— **CPU** = eksekusi instruksi\n— **RAM** = memori kerja sementara\n— **SSD/HDD** = penyimpanan\n— **GPU** = grafis/paralel\n— **Motherboard** = penghubung\n\nRAM besar = multitasking. SSD = booting cepat. CPU/GPU kuat = tugas berat.'
    },
    { id:'tek.internet', kategori:'teknologi',
      tags:['internet','wifi','jaringan','online','tcp'],
      patterns:[/apa\s+itu\s+internet|internet\s+itu/i],
      jawaban:()=>'**Internet** = jaringan komputer global memakai protokol **TCP/IP**. Data dipecah jadi paket, dikirim lewat router, disusun ulang. Layanan: WWW, email, streaming, VoIP. Ditemukan 1969 (ARPANET), WWW 1989 (Tim Berners-Lee).'
    },
    { id:'tek.ai', kategori:'teknologi',
      tags:['ai','artificial','intelligence','kecerdasan','buatan','ml','machine'],
      patterns:[/apa\s+itu\s+ai|kecerdasan\s+buatan|machine\s+learning|\bai\s+itu/i],
      jawaban:()=>'**AI** = sistem yang meniru kemampuan kognitif manusia. Cabang: **ML** (belajar dari data), **DL** (neural network berlapis), **NLP** (bahasa), **CV** (gambar). Contoh: ChatGPT, rekomendasi, terjemahan, chatbot.\n\nDeepz AI = bukan LLM — saya sistem rule-based + deep search.'
    },
    { id:'tek.ml', kategori:'teknologi',
      tags:['machine','learning','ml','supervised','unsupervised'],
      patterns:[/machine\s+learning|ml\s+itu/i],
      jawaban:()=>'**Machine Learning** = cabang AI yang membangun model dari data. Tipe: **supervised** (label), **unsupervised** (klaster), **reinforcement** (reward). Algoritma populer: regresi, decision tree, SVM, neural network.'
    },
    { id:'tek.smartphone', kategori:'teknologi',
      tags:['smartphone','hp','android','ios','ponsel'],
      patterns:[/smartphone|android|ios|ponsel/i],
      jawaban:()=>'**Smartphone** = HP dengan OS + aplikasi. OS utama: **Android** (Google, open source), **iOS** (Apple, tertutup). Komponen: SoC (CPU+GPU+RAM), kamera, baterai Li-ion, layar AMOLED/LCD. Ponsel pertama: Motorola DynaTAC (1983).'
    },
    { id:'tek.web', kategori:'teknologi',
      tags:['website','web','html','css','js','browser'],
      patterns:[/apa\s+itu\s+website|website\s+itu|bagaimana\s+web\s+bekerja/i],
      jawaban:()=>'**Website** = halaman yang diakses via browser. Struktur: **HTML** (struktur), **CSS** (tampilan), **JavaScript** (interaktif). Alur: browser → request ke server → server kirim HTML/CSS/JS → browser render. Protokol: HTTP/HTTPS.'
    },
    { id:'tek.cloud', kategori:'teknologi',
      tags:['cloud','aws','azure','server','hosting'],
      patterns:[/cloud\s+computing|komputasi\s+awan|aws|azure/i],
      jawaban:()=>'**Cloud computing** = penyediaan sumber daya komputasi (server, storage, database) lewat internet. Model: **IaaS** (infrastruktur), **PaaS** (platform), **SaaS** (software). Pemain besar: AWS, Azure, GCP. Kelebihan: skalabel, bayar sesuai pakai.'
    },
    { id:'tek.blockchain', kategori:'teknologi',
      tags:['blockchain','bitcoin','crypto','kripto'],
      patterns:[/blockchain|bitcoin|kripto|crypto/i],
      jawaban:()=>'**Blockchain** = ledger terdesentralisasi, blok data berantai dengan hash kriptografi. Tidak bisa diubah tanpa mengubah seluruh rantai. Dipakai oleh **Bitcoin** (2009, Satoshi Nakamoto), Ethereum (smart contract), dll. Kelebihan: transparan, desentralisasi. Kekurangan: boros energi, volatil.'
    },
    { id:'tek.iot', kategori:'teknologi',
      tags:['iot','internet','things','sensor','smart'],
      patterns:[/\biot\b|internet\s+of\s+things|smart\s+home/i],
      jawaban:()=>'**IoT** = jaringan perangkat fisik (sensor, kamera, lampu) terhubung internet. Contoh: smart home, smart watch, smart city. Protokol: MQTT, Zigbee, BLE. Tantangan: keamanan, privasi, interoperabilitas.'
    },
    { id:'tek.5g', kategori:'teknologi',
      tags:['5g','4g','lte','jaringan','seluler'],
      patterns:[/\b5g\b|\b4g\b|generasi\s+jaringan/i],
      jawaban:()=>'**5G** = generasi ke-5 jaringan seluler. Kecepatan hingga 10 Gbps (100× 4G), latensi <10 ms. Untuk: IoT, otonom, AR/VR. Generasi: 1G (1980, analog), 2G (1991, SMS), 3G (2001, data), 4G (2009, LTE), 5G (2019).'
    },
    { id:'tek.os', kategori:'teknologi',
      tags:['sistem','operasi','os','windows','linux','macos'],
      patterns:[/sistem\s+operasi|\bos\s+itu|windows|linux|macos/i],
      jawaban:()=>'**Sistem operasi** = software yang mengelola hardware & aplikasi. Contoh: **Windows** (Microsoft), **macOS** (Apple), **Linux** (open source — Ubuntu, Debian, Android), **iOS** (iPhone). Fungsi: file system, manajemen proses, driver, UI.'
    },
    { id:'tek.git', kategori:'teknologi',
      tags:['git','github','version','control','repo'],
      patterns:[/apa\s+itu\s+git|github\s+itu|version\s+control/i],
      jawaban:()=>'**Git** = sistem version control terdistribusi (2005, Linus Torvalds). Melacak perubahan kode. **GitHub** = platform hosting Git + kolaborasi (fork, PR, issue). Alternatif: GitLab, Bitbucket.'
    },
    { id:'tek.database', kategori:'teknologi',
      tags:['database','sql','nosql','mysql','mongodb'],
      patterns:[/apa\s+itu\s+database|database\s+itu|sql\s+itu/i],
      jawaban:()=>'**Database** = kumpulan data terstruktur. **SQL** (relasional): MySQL, PostgreSQL — tabel, relasi. **NoSQL**: MongoDB (dokumen), Redis (key-value), Cassandra (kolom). Pilih SQL untuk data terstruktur, NoSQL untuk fleksibel/skala besar.'
    },
    { id:'tek.api', kategori:'teknologi',
      tags:['api','endpoint','rest','json'],
      patterns:[/apa\s+itu\s+api|api\s+itu/i],
      jawaban:()=>'**API** (Application Programming Interface) = cara dua software berkomunikasi. **REST API** = standar HTTP (GET, POST, PUT, DELETE) dengan data JSON/XML. Contoh: ambil cuaca, login, kirim email. Dokumentasi pakai Swagger/Postman.'
    },
    { id:'tek.vpn', kategori:'teknologi',
      tags:['vpn','proxy','privasi','enkripsi'],
      patterns:[/apa\s+itu\s+vpn|vpn\s+itu/i],
      jawaban:()=>'**VPN** (Virtual Private Network) = terowongan terenkripsi antara perangkat & server. Menyembunyikan IP, mengamankan koneksi publik. Kegunaan: akses geo-restricted, privasi. Pilih VPN terpercaya — VPN gratis sering menjual data.'
    }
  ]);

  /* ---------- PEMROGRAMAN KONSEP ---------- */
  learnKnowledge([
    { id:'prog.variable', kategori:'pemrograman',
      tags:['variabel','variable'],
      patterns:[/apa\s+itu\s+variabel|variabel\s+itu/i],
      jawaban:()=>'**Variabel** = wadah menyimpan nilai di memori, diberi nama.\n\nJS: `let umur = 17;`\nC++: `int umur = 17;`\n\nBisa diubah (kecuali `const`). Tipe: number, string, boolean, objek.'
    },
    { id:'prog.function', kategori:'pemrograman',
      tags:['fungsi','function','method'],
      patterns:[/apa\s+itu\s+(fungsi|function)|fungsi\s+itu/i],
      jawaban:()=>'**Fungsi** = blok kode yang bisa dipanggil berulang untuk satu tugas.\n\nJS:\n```js\nfunction jumlah(a, b){ return a + b; }\njumlah(2, 3); // 5\n```\nC++:\n```cpp\nint jumlah(int a, int b){ return a + b; }\n```'
    },
    { id:'prog.loop', kategori:'pemrograman',
      tags:['loop','perulangan','for','while','iterasi'],
      patterns:[/apa\s+itu\s+(loop|perulangan)|(loop|perulangan)\s+itu/i],
      jawaban:()=>'**Loop** = jalankan blok kode berkali-kali.\n\n`for` = jumlah iterasi diketahui. `while` = kondisi. `foreach`/`for-of` = iterasi koleksi.\n\n```js\nfor (let i = 0; i < 5; i++) console.log(i);\n```'
    },
    { id:'prog.array', kategori:'pemrograman',
      tags:['array','list','larik'],
      patterns:[/apa\s+itu\s+array|array\s+itu/i],
      jawaban:()=>'**Array** = kumpulan nilai berurutan (indeks 0).\n\nJS: `let a = [1, 2, 3]; a[0] // 1`\nC++: `int a[] = {1, 2, 3};`\n\nMethod JS: `.map()`, `.filter()`, `.reduce()`, `.push()`, `.pop()`.'
    },
    { id:'prog.class', kategori:'pemrograman',
      tags:['class','kelas','oop','objek','inheritance'],
      patterns:[/apa\s+itu\s+(class|kelas|oop)|(class|kelas|oop)\s+itu/i],
      jawaban:()=>'**Class** = blueprint objek dengan properti + method. **OOP** punya 4 pilar: enkapsulasi, inheritance, polimorfisme, abstraksi.\n\n```js\nclass Mobil {\n  constructor(warna){ this.warna = warna; }\n  jalan(){ return "brum"; }\n}\n```'
    },
    { id:'prog.async', kategori:'pemrograman',
      tags:['async','promise','await','asynchronous','callback'],
      patterns:[/apa\s+itu\s+(async|promise|await)|(async|promise|await)\s+itu/i],
      jawaban:()=>'**Promise** = objek untuk nilai yang akan datang (sukses/gagal).\n**async/await** = tulis async seperti sinkron.\n\n```js\nasync function ambil() {\n  const r = await fetch("/api");\n  return await r.json();\n}\n```'
    },
    { id:'prog.recursion', kategori:'pemrograman',
      tags:['rekursi','recursion','recursive'],
      patterns:[/rekursi|recursion|recursive/i],
      jawaban:()=>'**Rekursi** = fungsi memanggil dirinya sendiri. Butuh **base case** agar berhenti.\n\n```js\nfunction faktorial(n){\n  if (n <= 1) return 1;\n  return n * faktorial(n - 1);\n}\n```\nGunakan rekursi untuk struktur pohon/graf.'
    },
    { id:'prog.algoritma', kategori:'pemrograman',
      tags:['algoritma','algorithm','kompleksitas'],
      patterns:[/apa\s+itu\s+algoritma|algoritma\s+itu/i],
      jawaban:()=>'**Algoritma** = urutan langkah terbatas untuk menyelesaikan masalah. Karakteristik: input, output, jelas, efisien, berhenti. Kompleksitas diukur dengan **Big O** (waktu & ruang).'
    },
    { id:'prog.bigo', kategori:'pemrograman',
      tags:['big','o','kompleksitas','notasi'],
      patterns:[/big\s*o|notasi\s+o|kompleksitas\s+waktu/i],
      jawaban:()=>'**Big O** = ukuran pertumbuhan waktu/ruang algoritma.\n\n— **O(1)** konstan\n— **O(log n)** biner search\n— **O(n)** linear\n— **O(n log n)** merge sort\n— **O(n²)** nested loop\n— **O(2ⁿ)** eksponensial (hindari!)'
    },
    { id:'prog.data.struct', kategori:'pemrograman',
      tags:['struktur','data','stack','queue','tree','graph'],
      patterns:[/struktur\s+data|data\s+structure|stack|queue/i],
      jawaban:()=>'**Struktur data** = cara menyimpan & mengorganisir data.\n\n— **Array** — akses O(1)\n— **Linked List** — insert/delete cepat\n— **Stack** — LIFO\n— **Queue** — FIFO\n— **Hash Map** — lookup O(1)\n— **Tree** — hirarki (BST untuk search O(log n))\n— **Graph** — jaringan node & edge'
    },
    { id:'prog.sorting', kategori:'pemrograman',
      tags:['sorting','sort','urutkan','quicksort','merge'],
      patterns:[/sorting|sort|quicksort|mergesort/i],
      jawaban:()=>'**Algoritma sorting**:\n— **Bubble/Insertion/Selection** O(n²) — simpel, lambat\n— **Merge Sort** O(n log n) — stabil, butuh memori\n— **Quick Sort** O(n log n) rata-rata — cepat di tempat\n— **Heap Sort** O(n log n)\n— **Counting/Radix** O(n+k) — untuk integer kecil'
    },
    { id:'prog.git.branch', kategori:'pemrograman',
      tags:['git','branch','merge','commit'],
      patterns:[/git\s+branch|git\s+merge|git\s+commit/i],
      jawaban:()=>'Alur Git dasar:\n```\ngit init\ngit add .\ngit commit -m "pesan"\ngit branch fitur\ngit checkout fitur\ngit merge fitur\n```\n**Pull request** = minta merge branch ke main lewat platform (GitHub).'
    },
    { id:'prog.debug', kategori:'pemrograman',
      tags:['debug','bug','error','console'],
      patterns:[/debug|bug|error\s+kode|console\s+log/i],
      jawaban:()=>'**Debugging** — langkah:\n1. Baca error message cermat\n2. Pakai `console.log()` / breakpoint\n3. Isolasi bagian yang error (comment out)\n4. Cek asumsi dengan print nilai\n5. Cari di Stack Overflow / dokumentasi resmi\n6. Rubber duck — jelaskan kode ke orang/benda'
    }
  ]);

  /* ---------- KESEHATAN ---------- */
  learnKnowledge([
    { id:'kes.tidur', kategori:'kesehatan',
      tags:['tidur','istirahat','insomnia','begadang','ngantuk'],
      patterns:[/tidur|insomnia|begadang|ngantuk/i],
      jawaban:()=>'Tidur ideal orang dewasa: **7–9 jam/malam**. Yang membantu:\n— Matikan layar 30–60 menit sebelum tidur\n— Jadwal konsisten (bangun & tidur jam sama)\n— Hindari kafein setelah sore\n— Kamar gelap, sejuk, sunyi\n\nInsomnia >3 minggu → konsultasi dokter.'
    },
    { id:'kes.olahraga', kategori:'kesehatan',
      tags:['olahraga','gym','fitnes','lari','jogging','sehat'],
      patterns:[/olahraga|gym|fitnes|fitness|lari|jogging/i],
      jawaban:()=>'Olahraga minimum **150 menit/minggu intensitas sedang** (± 30 menit × 5 hari). Kombinasi ideal:\n— 2× latihan kekuatan (beban/bodyweight)\n— 3× kardio (jalan cepat, jogging)\n— Peregangan tiap hari\n\nMulai dari yang bisa dilakukan.'
    },
    { id:'kes.diet', kategori:'kesehatan',
      tags:['diet','gizi','kalori','berat','badan'],
      patterns:[/diet|gizi|kalori|turun\s+berat|gemuk/i],
      jawaban:()=>'Prinsip diet sehat:\n— **Defisit kalori** moderat (300–500 kkal/hari)\n— Protein cukup (1,6 g/kg BB untuk aktif)\n— Sayur + buah tiap makan\n— Hindari gula/minyak berlebih\n— Minum 2 L air\n— Tidur cukup\n\nTurun berat sehat: 0,5–1 kg/minggu. Hindari diet ekstrem.'
    },
    { id:'kes.vitamin', kategori:'kesehatan',
      tags:['vitamin','suplemen','defisiensi'],
      patterns:[/vitamin|suplemen|defisiensi/i],
      jawaban:()=>'Vitamin dari makanan dulu:\n— **D** — sinar matahari, ikan, kuning telur\n— **C** — jeruk, brokoli, paprika\n— **B12** — daging, telur (risiko kurang untuk vegan)\n— **A, E, K** — sayur hijau, wortel\n\nSuplemen hanya kalau ada defisiensi terbukti. Konsultasi dokter.'
    },
    { id:'kes.air', kategori:'kesehatan',
      tags:['air','minum','hidrasi','dehidrasi'],
      patterns:[/berapa\s+air|minum\s+air|hidrasi/i],
      jawaban:()=>'Kebutuhan air ±**2 L/hari** (8 gelas) untuk dewasa, bisa lebih kalau aktif/panas. Tanda dehidrasi: urine gelap, pusing, lemas. Minum sebelum haus. Kopi/teh tetap dihitung, alkohol tidak (dehidrasi).'
    },
    { id:'kes.stres', kategori:'kesehatan',
      tags:['stres','stress','cemas','anxiety','panik'],
      patterns:[/stres|stress|cemas|anxiety|panik/i],
      jawaban:()=>'Kelola stres:\n— Napas dalam (4 detik tarik, 4 tahan, 4 buang)\n— Olahraga rutin\n— Tidur cukup\n— Batasi berita/sosmed\n— Curhat ke orang dipercaya\n— Meditasi/mindfulness 10 menit/hari\n\nKalau mengganggu fungsi sehari-hari >2 minggu, konsultasi profesional.'
    },
    { id:'kes.jantung', kategori:'kesehatan',
      tags:['jantung','kardiovaskular','kolesterol','darah'],
      patterns:[/jantung|kolesterol|serangan\s+jantung/i],
      jawaban:()=>'Jantung sehat:\n— Olahraga 150 menit/minggu\n— Diet rendah lemak jenuh & garam\n— Jaga berat badan ideal\n— Tidak merokok\n— Cek tekanan darah & kolesterol rutin\n— Kelola stres\n\nSerangan jantung: nyeri dada kiri menjalar ke lengan/rahang, napas pendek → segera ke IGD.'
    },
    { id:'kes.diabetes', kategori:'kesehatan',
      tags:['diabetes','gula','darah','insulin'],
      patterns:[/diabetes|gula\s+darah|insulin/i],
      jawaban:()=>'**Diabetes** = kadar gula darah tinggi kronis. Tipe 1 (autoimun, butuh insulin), Tipe 2 (resistensi insulin, terkait gaya hidup). Cegah: berat ideal, aktif, kurangi gula-olahan. Cek HbA1c rutin jika berisiko.'
    },
    { id:'kes.darah.tinggi', kategori:'kesehatan',
      tags:['darah','tinggi','hipertensi','tekanan'],
      patterns:[/darah\s+tinggi|hipertensi|tekanan\s+darah/i],
      jawaban:()=>'**Hipertensi** = tekanan darah ≥140/90 mmHg. "Silent killer" — sering tanpa gejala. Cegah: kurangi garam (<5 g/hari), olahraga, jaga berat, kurangi alkohol, kelola stres. Rutin cek tekanan darah.'
    },
    { id:'kes.vaksin', kategori:'kesehatan',
      tags:['vaksin','imunisasi','antibodi'],
      patterns:[/vaksin|imunisasi|antibodi/i],
      jawaban:()=>'**Vaksin** = melatih sistem imun mengenali patogen tanpa sakit berat. Berisi antigen lemah/mati. Merangsang antibodi & memory cell. Contoh: BCG, hepatitis, influenza, COVID-19. Efektivitas bergantung jenis, biasanya 50–95%.'
    },
    { id:'kes.demam', kategori:'kesehatan',
      tags:['demam','panas','flu','batuk','pilek'],
      patterns:[/demam|panas\s+tubuh|flu|batuk|pilek/i],
      jawaban:()=>'Demam = suhu >37,5°C, tanda tubuh melawan infeksi. Pertolongan: banyak minum, istirahat, paracetamol (sesuai dosis). Ke dokter jika: >39°C, >3 hari, disertai sesak/kejang/ruam, atau pada bayi/anak kecil.'
    },
    { id:'kes.covid', kategori:'kesehatan',
      tags:['covid','corona','sars','pandemi'],
      patterns:[/covid|corona|sars-cov/i],
      jawaban:()=>'**COVID-19** = penyakit dari virus SARS-CoV-2, pertama terdeteksi Wuhan (Des 2019), jadi pandemi Maret 2020. Gejala: demam, batuk, sesak, hilang penciuman. Pencegahan: vaksin, masker, cuci tangan, jaga jarak.'
    }
  ]);

  /* ---------- EKONOMI ---------- */
  learnKnowledge([
    { id:'eko.inflasi', kategori:'ekonomi',
      tags:['inflasi','harga','naik','rupiah'],
      patterns:[/inflasi|kenapa\s+harga\s+naik/i],
      jawaban:()=>'**Inflasi** = kenaikan harga barang/jasa secara umum & terus-menerus. Penyebab: permintaan tinggi, biaya produksi naik, uang beredar banyak. Dampak: daya beli turun. Bank sentral kendalikan lewat suku bunga.'
    },
    { id:'eko.gdp', kategori:'ekonomi',
      tags:['gdp','pdb','ekonomi','produk','domestik'],
      patterns:[/\bgdp\b|pdb|produk\s+domestik/i],
      jawaban:()=>'**GDP** (PDB) = nilai total barang/jasa yang diproduksi suatu negara dalam setahun. GDP per kapita = GDP / jumlah penduduk. Indikator ukuran ekonomi, tapi tidak ukur pemerataan (lihat Gini ratio).'
    },
    { id:'eko.saham', kategori:'ekonomi',
      tags:['saham','stock','investasi','bursa'],
      patterns:[/apa\s+itu\s+saham|saham\s+itu|investasi\s+saham/i],
      jawaban:()=>'**Saham** = bukti kepemilikan sebagian perusahaan. Beli = jadi pemegang saham, dapat dividen + capital gain (jika harga naik). Risiko: harga bisa turun. Bursa Indonesia: **IDX**. Beli via broker sekuritas resmi.'
    },
    { id:'eko.obligasi', kategori:'ekonomi',
      tags:['obligasi','bond','surat','utang'],
      patterns:[/obligasi|bond\s+itu/i],
      jawaban:()=>'**Obligasi** = surat utang. Beli = pinjamkan uang ke penerbit (pemerintah/perusahaan), dapat bunga (kupon) + pokok saat jatuh tempo. Risiko lebih rendah dari saham, tapi ada risiko gagal bayar.'
    },
    { id:'eko.reksadana', kategori:'ekonomi',
      tags:['reksa','dana','mutual','fund'],
      patterns:[/reksa\s+dana|reksadana/i],
      jawaban:()=>'**Reksa dana** = wadah investasi yang mengumpulkan dana banyak orang, dikelola manajer investasi. Jenis: **pasar uang** (rendah risiko), **obligasi**, **saham** (tinggi risiko), **campuran**. Cocok untuk pemula.'
    },
    { id:'eko.bunga', kategori:'ekonomi',
      tags:['bunga','interest','bank','majemuk'],
      patterns:[/bunga\s+bank|bunga\s+majemuk|interest/i],
      jawaban:()=>'**Bunga** = biaya pinjam uang atau imbal hasil simpanan. **Bunga majemuk** = bunga dihitung dari pokok + bunga sebelumnya: `A = P(1 + r/n)^(nt)`. Bunga majemuk = keajaiban investasi jangka panjang.'
    },
    { id:'eko.pajak', kategori:'ekonomi',
      tags:['pajak','tax','pph','ppn'],
      patterns:[/pajak|pph|ppn/i],
      jawaban:()=>'**Pajak** = kontribusi wajib rakyat ke negara untuk pembangunan. Di Indonesia: **PPh** (pendapatan), **PPN** (pertambahan nilai — 11%), **PBB** (bumi & bangunan). Wajib lapor SPT tahunan bagi yang berpenghasilan.'
    },
    { id:'eko.tabungan', kategori:'ekonomi',
      tags:['tabungan','menabung','dana','darurat'],
      patterns:[/tabungan|dana\s+darurat|menabung/i],
      jawaban:()=>'**Dana darurat** = 3–6× pengeluaran bulanan (6–12× jika freelance). Taruh di tabungan/reksa dana pasar uang. Aturan 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan/investasi.'
    },
    { id:'eko.crypto', kategori:'ekonomi',
      tags:['crypto','bitcoin','kripto','ethereum'],
      patterns:[/crypto|bitcoin|kripto|ethereum/i],
      jawaban:()=>'**Cryptocurrency** = mata uang digital terdesentralisasi berbasis blockchain. Contoh: Bitcoin, Ethereum. Kelebihan: transparan, tanpa bank. Kekurangan: **sangat volatil**, regulasi belum jelas di banyak negara, rawan penipuan. Bukan investasi aman untuk pemula.'
    }
  ]);

  /* ---------- PSIKOLOGI ---------- */
  learnKnowledge([
    { id:'psi.motivasi', kategori:'psikologi',
      tags:['motivasi','semangat','malas','putus','asa'],
      patterns:[/motivasi|semangat|malas|putus\s+asa/i],
      jawaban:()=>'Motivasi bukan perasaan yang datang sendiri — ia dibangun. Kunci:\n— Kecilkan target (2 menit saja dulu)\n— Ikuti rutinitas, bukan mood\n— Catat progres\n— Rayakan pencapaian kecil\n— Kelilingi orang yang mendukung\n\nAksi dulu, motivasi menyusul.'
    },
    { id:'psi.depresi', kategori:'psikologi',
      tags:['depresi','sedih','putus','harapan'],
      patterns:[/depresi|sedih\s+terus|putus\s+harapan/i],
      jawaban:()=>'**Depresi** = gangguan mood serius (bukan sekadar sedih). Gejala: hilang minat, lelah, sulit fokus, gangguan tidur, perasaan tidak berharga >2 minggu. **Bukan kelemahan** — perlu bantuan profesional. Bicara ke psikolog/psikiater. Kalau ada pikiran menyakiti diri, segera cari bantuan.'
    },
    { id:'psi.anxiety', kategori:'psikologi',
      tags:['anxiety','cemas','panik','khawatir'],
      patterns:[/anxiety|cemas|panik|khawatir\s+berlebihan/i],
      jawaban:()=>'**Anxiety disorder** = kecemasan intens & mengganggu fungsi. Ciri: gelisah terus, sulit tidur, sesak, jantung berdebar tanpa pemicu jelas. Terapi: **CBT**, olahraga, tidur cukup, batasi kafein. Kalau berat, konsultasi profesional.'
    },
    { id:'psi.kebiasaan', kategori:'psikologi',
      tags:['kebiasaan','habit','rutin','disiplin'],
      patterns:[/kebiasaan|habit|disiplin|rutin/i],
      jawaban:()=>'Bangun kebiasaan pakai **habit loop**: pemicu → rutinitas → hadiah.\n\nTips:\n— Mulai sangat kecil (2 menit)\n— Tempel ke kebiasaan lama\n— Track harian\n— Jangan putus 2× berturut-turut\n— Fokus sistem, bukan target\n\nButuh ±66 hari untuk jadi otomatis.'
    },
    { id:'psi.memory', kategori:'psikologi',
      tags:['memori','ingat','lupa','memory'],
      patterns:[/memori|daya\s+ingat|gampang\s+lupa/i],
      jawaban:()=>'Memori kuat dengan:\n— **Spaced repetition** (ulang di hari 1, 3, 7, 14, 30)\n— **Active recall** (uji diri, bukan baca ulang)\n— Tidur cukup (konsolidasi memori saat tidur)\n— Olahraga\n— Jembatan memori (asosiasi visual)\n— Ajarkan orang lain'
    },
    { id:'psi.iq.eq', kategori:'psikologi',
      tags:['iq','eq','kecerdasan','emosional'],
      patterns:[/\biq\b|\beq\b|kecerdasan\s+emosional/i],
      jawaban:()=>'**IQ** = kecerdasan logika-analitis (rata-rata 100). **EQ** = kecerdasan emosional — kenali & kelola emosi, empati, sosial. Riset menunjukkan EQ sering lebih menentukan kesuksesan daripada IQ. Keduanya bisa dilatih.'
    },
    { id:'psi.meditasi', kategori:'psikologi',
      tags:['meditasi','mindfulness','relaksasi','napas'],
      patterns:[/meditasi|mindfulness|relaksasi/i],
      jawaban:()=>'**Meditasi/mindfulness** = latihan fokus pada saat ini. Manfaat: kurangi stres, tingkatkan fokus, tidur lebih baik. Mulai 5 menit/hari: duduk nyaman, fokus napas, biarkan pikiran lewat tanpa menghakimi. Aplikasi: Headspace, Calm, Insight Timer.'
    },
    { id:'psi.belajar', kategori:'psikologi',
      tags:['belajar','study','pomodoro','efektif'],
      patterns:[/cara\s+belajar|teknik\s+belajar|pomodoro/i],
      jawaban:()=>'Teknik belajar efektif:\n1. **Pomodoro** — 25 menit fokus, 5 istirahat\n2. **Active recall** — tutup buku, jelaskan sendiri\n3. **Spaced repetition** — ulang berjeda\n4. **Feynman** — jelaskan sesederhana mungkin\n5. **Interleaving** — campur topik\n6. Tidur cukup'
    }
  ]);

  /* ---------- MAKANAN ---------- */
  learnKnowledge([
    { id:'mak.sehat', kategori:'makanan',
      tags:['makanan','sehat','gizi','nutrisi'],
      patterns:[/makanan\s+sehat|menu\s+sehat|gizi\s+seimbang/i],
      jawaban:()=>'Piring sehat: **½ sayur & buah**, **¼ protein** (ikan/ayam/telur/tahu), **¼ karbo kompleks** (nasi merah/kentang/oat). Batasi gula, garam, lemak jenuh. Minum air 2 L. Variasi warna = variasi gizi.'
    },
    { id:'mak.kopi', kategori:'makanan',
      tags:['kopi','kafein','cafein','espresso'],
      patterns:[/kopi|kafein|cafein/i],
      jawaban:()=>'**Kopi** mengandung kafein (80–100 mg/cangkir). Batas aman: ±400 mg kafein/hari (±4 cangkir). Efek: fokus jangka pendek. Hindari setelah jam 2 siang (ganggu tidur). Kalau asam lambung sensitif, pilih kopi rendah asam/cold brew.'
    },
    { id:'mak.protein', kategori:'makanan',
      tags:['protein','otot','asam','amino'],
      patterns:[/protein|sumber\s+protein/i],
      jawaban:()=>'**Protein** penting untuk otot, hormon, enzim. Kebutuhan: 0,8 g/kg BB (orang biasa), 1,6–2,2 g/kg (aktif/atlet). Sumber: telur, ayam, ikan, daging, tahu, tempe, kacang-kacangan, susu, whey.'
    },
    { id:'mak.buah', kategori:'makanan',
      tags:['buah','vitamin','serat'],
      patterns:[/buah|vitamin\s+c|serat/i],
      jawaban:()=>'Buah kaya vitamin, mineral, serat, antioksidan. Target 2–3 porsi/hari. Contoh super: pisang (kalium), jeruk (vit C), beri (antioksidan), alpukat (lemak baik), apel (serat).'
    },
    { id:'mak.resep', kategori:'makanan',
      tags:['resep','masak','resep','masakan'],
      patterns:[/resep|masak|cara\s+buat\s+makanan/i],
      jawaban:()=>'Resep cepat & bergizi: **nasi + telur + tumis sayur**. Bumbu dasar: bawang putih, bawang merah, garam, kecap. Mau resep spesifik (nasi goreng, soto, rendang)? Sebut nama masakannya.'
    }
  ]);

  /* ---------- BAHASA ---------- */
  learnKnowledge([
    { id:'bah.indonesia', kategori:'bahasa',
      tags:['bahasa','indonesia','ejaan','kbbi'],
      patterns:[/bahasa\s+indonesia|kbbi|ejaan/i],
      jawaban:()=>'**Bahasa Indonesia** = bahasa resmi RI, rumpun Austronesia, diresmikan lewat Sumpah Pemuda 1928. Panduan: **KBBI** untuk kosakata, **PUEBI** untuk ejaan. Ada ±127.000 lema di KBBI.'
    },
    { id:'bah.inggris', kategori:'bahasa',
      tags:['bahasa','inggris','english','grammar'],
      patterns:[/bahasa\s+inggris|grammar|english\s+itu/i],
      jawaban:()=>'**Bahasa Inggris** = bahasa global, lingua franca bisnis & teknologi. Kunci belajar: **listening** (film/podcast), **speaking** (shadowing), **reading** (artikel), **writing** (jurnal). Grammar dasar: 12 tenses, modal, passive voice.'
    },
    { id:'bah.asing', kategori:'bahasa',
      tags:['bahasa','asing','belajar','mandarin','jepang'],
      patterns:[/belajar\s+bahasa|cara\s+belajar\s+bahasa/i],
      jawaban:()=>'Belajar bahasa baru:\n— 20 menit/hari konsisten > 2 jam sekali seminggu\n— Input masif (dengar & baca) dulu\n— Shadowing (tirukan penutur asli)\n— Flashcard (Anki) untuk kosakata\n— Cari partner bicara (HelloTalk, Tandem)\n— Tetapkan target komunikasi, bukan hafalan'
    }
  ]);

  /* ---------- PENDIDIKAN ---------- */
  learnKnowledge([
    { id:'pen.sekolah', kategori:'pendidikan',
      tags:['sekolah','kuliah','ujian','nilai'],
      patterns:[/masuk\s+sekolah|masuk\s+kuliah|ujian/i],
      jawaban:()=>'Tips sukses sekolah/kuliah:\n— Manajemen waktu (to-do list + blok waktu)\n— Belajar aktif (bukan sekadar baca)\n— Ikut diskusi/organisasi\n— Tidur cukup (7–9 jam)\n— Olahraga rutin\n— Bangun relasi dengan guru/dosen'
    },
    { id:'pen.pomodoro', kategori:'pendidikan',
      tags:['pomodoro','fokus','teknik','belajar'],
      patterns:[/pomodoro|teknik\s+fokus/i],
      jawaban:()=>'**Pomodoro** = 25 menit fokus + 5 menit istirahat. Setelah 4 sesi, istirahat 15–30 menit. Alat: timer HP, Forest, Pomofocus. Efektif karena melatih fokus pendek & mencegah kelelahan.'
    }
  ]);

  /* ---------- OLAHRAGA ---------- */
  learnKnowledge([
    { id:'or.sepakbola', kategori:'olahraga',
      tags:['sepak','bola','fifa','football'],
      patterns:[/sepak\s*bola|piala\s+dunia|fifa/i],
      jawaban:()=>'**Sepak bola** = olahraga paling populer di dunia, ±4 miliar penggemar. 11 vs 11, 90 menit. Organisasi: **FIFA** (dunia), **PSSI** (Indonesia). Piala Dunia tiap 4 tahun.'
    },
    { id:'or.badminton', kategori:'olahraga',
      tags:['badminton','bulu','tangkis'],
      patterns:[/bulu\s*tangkis|badminton/i],
      jawaban:()=>'**Bulu tangkis** = olahraga raket dengan kok. Indonesia salah satu negara terkuat (juara Thomas Cup 14×, Uber Cup 3×). Turnamen: All England, BWF World Championships, Olimpiade.'
    },
    { id:'or.olimpiade', kategori:'olahraga',
      tags:['olimpiade','olympic','olimpik'],
      patterns:[/olimpiade|olympic/i],
      jawaban:()=>'**Olimpiade** = ajang multi-olahraga 4 tahunan, awalnya di Yunani kuno (±776 SM), dimodernkan Pierre de Coubertin 1896. Edisi musim panas & musim dingin. Indonesia pertama ikut 1952, pertama raih emas 1992 (Susi Susanti, bulu tangkis).'
    },
    { id:'or.renang', kategori:'olahraga',
      tags:['renang','swim','kolam'],
      patterns:[/renang|berenang/i],
      jawaban:()=>'**Renang** = olahraga seluruh tubuh, latih kardio + otot + pernapasan. Gaya: bebas, punggung, dada, kupu-kupu. Rendah cedera — cocok untuk semua usia. Bakal bagus untuk pemula: 20 menit, 3× per minggu.'
    }
  ]);

  /* ---------- LINGKUNGAN ---------- */
  learnKnowledge([
    { id:'lin.pemanasan', kategori:'lingkungan',
      tags:['global','warming','pemanasan','iklim'],
      patterns:[/global\s+warming|pemanasan\s+global|perubahan\s+iklim/i],
      jawaban:()=>'**Pemanasan global** = kenaikan suhu rata-rata Bumi karena emisi gas rumah kaca (CO₂, CH₄). Efek: es kutub meleleh, permukaan laut naik, cuaca ekstrem. Aksi: kurangi energi fosil, hemat listrik, tanam pohon, dukung energi terbarukan.'
    },
    { id:'lin.daur', kategori:'lingkungan',
      tags:['daur','ulang','sampah','recycle'],
      patterns:[/daur\s+ulang|sampah|reduce\s+reuse\s+recycle/i],
      jawaban:()=>'**3R**: Reduce (kurangi), Reuse (pakai ulang), Recycle (daur ulang). Tips: bawa tas belanja sendiri, hindari sedotan plastik, pisahkan sampah organik/anorganik, kompos untuk sisa makanan.'
    },
    { id:'lin.terbarukan', kategori:'lingkungan',
      tags:['energi','terbarukan','solar','angin','air'],
      patterns:[/energi\s+terbarukan|solar\s+panel|tenaga\s+angin/i],
      jawaban:()=>'**Energi terbarukan** = sumber energi yang dapat diperbarui: **surya** (panel PV), **angin** (turbin), **air** (PLTA), **biomassa**, **panas bumi**, **ombak**. Lawan dari energi fosil (batu bara, minyak, gas) yang terbatas & mencemari.'
    }
  ]);

  /* ---------- TRANSPORTASI ---------- */
  learnKnowledge([
    { id:'tr.motor', kategori:'transportasi',
      tags:['motor','sepeda','kendaraan'],
      patterns:[/motor|sepeda\s+motor|kendaraan/i],
      jawaban:()=>'Motor = kendaraan 2 roda, ekonomis & lincah di perkotaan. Wajib: SIM C, helm SNI, lampu, spion. Servis rutin: ganti oli tiap 2.000–3.000 km, cek rem & ban. Hemat BBM: jaga tekanan ban, jangan beban berlebih.'
    },
    { id:'tr.mobil', kategori:'transportasi',
      tags:['mobil','car','kendaraan'],
      patterns:[/mobil|kendaraan\s+roda\s+empat/i],
      jawaban:()=>'Mobil butuh: SIM A, STNK, pajak tahunan. Perawatan: ganti oli 5.000–10.000 km, cek rem, ban, radiator, aki. Hemat BBM: hindari akselerasi mendadak, jaga tekanan ban, servis rutin.'
    }
  ]);

  /* ---------- KEAMANAN DIGITAL ---------- */
  learnKnowledge([
    { id:'sek.password', kategori:'keamanan',
      tags:['password','sandi','keamanan','akun'],
      patterns:[/password|sandi|keamanan\s+akun/i],
      jawaban:()=>'Password aman:\n— Min 12 karakter, campur huruf/angka/simbol\n— Jangan pakai ulang antar situs\n— Pakai **password manager** (Bitwarden, 1Password)\n— Aktifkan **2FA** (autentikasi dua faktor)\n— Jangan bagikan ke siapa pun'
    },
    { id:'sek.phishing', kategori:'keamanan',
      tags:['phishing','penipuan','scam','tipu'],
      patterns:[/phishing|penipuan\s+online|scam/i],
      jawaban:()=>'**Phishing** = penipuan yang menyamar sebagai pihak resmi untuk curi data. Tanda: URL aneh, ejaan salah, minta password/OTP, ancaman "akun diblokir". Jangan klik link mencurigakan. Cek langsung ke situs resmi. Laporkan ke bank/platform.'
    }
  ]);

  /* ---------- INDONESIA ---------- */
  learnKnowledge([
    { id:'idn.pancasila', kategori:'indonesia',
      tags:['pancasila','dasar','negara'],
      patterns:[/pancasila/i],
      jawaban:()=>'**Pancasila** = dasar negara Indonesia, 5 sila:\n1. Ketuhanan Yang Maha Esa\n2. Kemanusiaan yang adil & beradab\n3. Persatuan Indonesia\n4. Kerakyatan yang dipimpin oleh hikmat kebijaksanaan dalam permusyawaratan/perwakilan\n5. Keadilan sosial bagi seluruh rakyat Indonesia'
    },
    { id:'idn.bahasa', kategori:'indonesia',
      tags:['bahasa','indonesia','resmi','nasional'],
      patterns:[/bahasa\s+resmi\s+indonesia|bahasa\s+nasional/i],
      jawaban:()=>'Bahasa Indonesia = bahasa resmi & nasional RI. Diresmikan lewat **Sumpah Pemuda 28 Oktober 1928**. Berakar dari bahasa Melayu. Panduan ejaan: **PUEBI**, kosakata: **KBBI**.'
    },
    { id:'idn.rupiah', kategori:'indonesia',
      tags:['rupiah','idr','mata','uang'],
      patterns:[/rupiah|idr|mata\s+uang\s+indonesia/i],
      jawaban:()=>'**Rupiah (IDR)** = mata uang resmi Indonesia. Simbol: **Rp**. Diterbitkan **Bank Indonesia**. Pecahan uang kertas: 1.000, 2.000, 5.000, 10.000, 20.000, 50.000, 100.000. Logam: 100, 200, 500, 1.000.'
    }
  ]);

  /* =========================================================
     ============ TEMPLATE KODE ============
     ========================================================= */

  /* ---------- HTML ---------- */
  learnCode('html', [
    { keys:['login','masuk','signin','form login'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Login</title>
<style>
  body{font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0f172a;}
  .card{background:#1e293b;padding:32px;border-radius:14px;width:320px;color:#e2e8f0;box-shadow:0 10px 40px rgba(0,0,0,.4);}
  h2{margin:0 0 20px;}
  input{width:100%;padding:11px;margin-bottom:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;box-sizing:border-box;}
  button{width:100%;padding:11px;border:none;border-radius:8px;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;}
</style>
</head>
<body>
  <div class="card">
    <h2>Masuk</h2>
    <form onsubmit="event.preventDefault(); alert('Login: ' + this.u.value);">
      <input name="u" placeholder="Username" required>
      <input name="p" type="password" placeholder="Password" required>
      <button type="submit">Masuk</button>
    </form>
  </div>
</body>
</html>` },

    { keys:['tabel','table','data'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Tabel</title>
<style>
  body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:30px;}
  table{border-collapse:collapse;width:100%;max-width:600px;background:#1e293b;border-radius:10px;overflow:hidden;}
  th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #334155;}
  th{background:#334155;}
  tr:hover{background:#1f2b3d;}
</style>
</head>
<body>
  <h2>Daftar Pengguna</h2>
  <table>
    <thead><tr><th>No</th><th>Nama</th><th>Email</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Andi</td><td>andi@mail.com</td></tr>
      <tr><td>2</td><td>Budi</td><td>budi@mail.com</td></tr>
    </tbody>
  </table>
</body>
</html>` },

    { keys:['navbar','menu','navigasi'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Navbar</title>
<style>
  body{margin:0;font-family:sans-serif;background:#0f172a;color:#e2e8f0;}
  nav{display:flex;align-items:center;gap:20px;padding:14px 26px;background:#1e293b;border-bottom:1px solid #334155;}
  .brand{font-weight:800;font-size:18px;background:linear-gradient(90deg,#3b82f6,#8b5cf6);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  nav a{color:#cbd5e1;text-decoration:none;padding:6px 10px;border-radius:6px;}
  nav a:hover{background:#334155;color:#fff;}
  nav .spacer{flex:1;}
</style>
</head>
<body>
  <nav>
    <div class="brand">MyApp</div>
    <a href="#">Home</a><a href="#">Fitur</a><a href="#">Harga</a>
    <div class="spacer"></div>
    <a href="#">Masuk</a>
  </nav>
</body>
</html>` },

    { keys:['card','kartu','produk'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Card</title>
<style>
  body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;display:flex;gap:16px;flex-wrap:wrap;}
  .card{width:240px;background:#1e293b;border-radius:14px;overflow:hidden;border:1px solid #334155;transition:.2s;}
  .card:hover{transform:translateY(-4px);border-color:#3b82f6;}
  .card .body{padding:16px;}
  .card h3{margin:0 0 8px;}
  .card p{margin:0;color:#94a3b8;font-size:13px;}
  .card button{margin-top:12px;width:100%;padding:9px;border:none;border-radius:8px;background:#3b82f6;color:#fff;cursor:pointer;}
</style>
</head>
<body>
  <div class="card">
    <div style="height:140px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);"></div>
    <div class="body">
      <h3>Nama Produk</h3>
      <p>Deskripsi singkat.</p>
      <button>Beli</button>
    </div>
  </div>
</body>
</html>` },

    { keys:['kalkulator','calculator','hitung'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Kalkulator</title>
<style>
  body{font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0f172a;}
  .calc{background:#1e293b;padding:20px;border-radius:16px;width:280px;color:#e2e8f0;}
  #disp{width:100%;padding:14px;background:#0f172a;border:none;border-radius:10px;
    color:#fff;font-size:22px;text-align:right;margin-bottom:12px;box-sizing:border-box;}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  button{padding:16px;border:none;border-radius:10px;background:#334155;color:#fff;
    font-size:16px;cursor:pointer;}
  button:hover{background:#475569;}
  .op{background:#3b82f6;}
  .eq{background:#8b5cf6;grid-column:span 2;}
</style>
</head>
<body>
  <div class="calc">
    <input id="disp" value="" readonly>
    <div class="grid">
      <button onclick="d('7')">7</button><button onclick="d('8')">8</button>
      <button onclick="d('9')">9</button><button class="op" onclick="d('/')">÷</button>
      <button onclick="d('4')">4</button><button onclick="d('5')">5</button>
      <button onclick="d('6')">6</button><button class="op" onclick="d('*')">×</button>
      <button onclick="d('1')">1</button><button onclick="d('2')">2</button>
      <button onclick="d('3')">3</button><button class="op" onclick="d('-')">−</button>
      <button onclick="d('0')">0</button><button onclick="d('.')">.</button>
      <button class="op" onclick="d('+')">+</button><button class="op" onclick="clearAll()">C</button>
      <button class="eq" onclick="hit()">=</button>
    </div>
  </div>
  <script>
    const disp = document.getElementById('disp');
    function d(v){ disp.value += v; }
    function clearAll(){ disp.value = ''; }
    function hit(){ try { disp.value = eval(disp.value); } catch(e){ disp.value = 'Error'; } }
  <\/script>
</body>
</html>` },

    { keys:['todo','list','daftar','tugas'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Todo</title>
<style>
  body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:480px;margin:0 auto;}
  h1{margin:0 0 20px;}
  .add{display:flex;gap:8px;margin-bottom:20px;}
  input{flex:1;padding:10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#fff;}
  button{padding:10px 16px;border:none;border-radius:8px;background:#3b82f6;color:#fff;cursor:pointer;}
  li{background:#1e293b;padding:12px 16px;border-radius:8px;margin-bottom:8px;
    display:flex;justify-content:space-between;align-items:center;list-style:none;}
  li.done{text-decoration:line-through;opacity:.5;}
  ul{padding:0;}
</style>
</head>
<body>
  <h1>Todo</h1>
  <div class="add">
    <input id="inp" placeholder="Tugas baru...">
    <button onclick="add()">Tambah</button>
  </div>
  <ul id="list"></ul>
  <script>
    const inp = document.getElementById('inp');
    const list = document.getElementById('list');
    function add(){
      if (!inp.value.trim()) return;
      const li = document.createElement('li');
      li.innerHTML = '<span>' + inp.value + '</span><button onclick="this.parentElement.remove()">×</button>';
      li.querySelector('span').onclick = () => li.classList.toggle('done');
      list.appendChild(li);
      inp.value = '';
    }
    inp.addEventListener('keydown', e => e.key === 'Enter' && add());
  <\/script>
</body>
</html>` },

    { keys:['landing','halaman','page','promo'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Landing</title>
<style>
  body{margin:0;font-family:sans-serif;background:#0f172a;color:#e2e8f0;}
  header{text-align:center;padding:80px 20px;background:linear-gradient(135deg,#1e293b,#0f172a);}
  h1{margin:0 0 16px;font-size:42px;background:linear-gradient(90deg,#3b82f6,#8b5cf6);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  p{color:#94a3b8;font-size:16px;max-width:520px;margin:0 auto 24px;}
  button{padding:12px 28px;border:none;border-radius:10px;background:#3b82f6;color:#fff;
    font-size:16px;font-weight:600;cursor:pointer;}
</style>
</head>
<body>
  <header>
    <h1>Produk Hebatmu</h1>
    <p>Deskripsi singkat yang membuat orang ingin tahu lebih banyak.</p>
    <button onclick="alert('Terima kasih!')">Mulai Sekarang</button>
  </header>
</body>
</html>` },

    { default:true, keys:['halaman','sederhana','dasar'], build: () => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Halaman</title>
<style>
  body{margin:0;font-family:sans-serif;background:#0f172a;color:#e2e8f0;
    display:grid;place-items:center;height:100vh;text-align:center;}
  h1{background:linear-gradient(90deg,#3b82f6,#8b5cf6);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
</style>
</head>
<body>
  <div>
    <h1>Halo, Dunia!</h1>
    <p>Halaman HTML dasar.</p>
  </div>
</body>
</html>` }
  ]);

  /* ---------- JS ---------- */
  learnCode('js', [
    { keys:['fungsi','function','tambah','hitung'], build: () => `function tambah(a, b) {
  return a + b;
}

const hasil = tambah(5, 3);
console.log("Hasil:", hasil); // 8` },

    { keys:['loop','perulangan','for','while','iterasi'], build: () => `for (let i = 1; i <= 5; i++) {
  console.log("Hitungan ke-" + i);
}

let n = 0;
while (n < 3) {
  console.log("While ke-" + n);
  n++;
}` },

    { keys:['class','kelas','oop','objek'], build: () => `class Mobil {
  constructor(nama, kecepatan) {
    this.nama = nama;
    this.kecepatan = kecepatan;
  }
  info() {
    return this.nama + " melaju " + this.kecepatan + " km/jam";
  }
}

const m = new Mobil("Avanza", 120);
console.log(m.info());` },

    { keys:['array','map','filter','reduce','list'], build: () => `const angka = [1, 2, 3, 4, 5];

const kuadrat = angka.map(x => x * x);
const genap = angka.filter(x => x % 2 === 0);
const jumlah = angka.reduce((a, b) => a + b, 0);

console.log(kuadrat); // [1,4,9,16,25]
console.log(genap);   // [2,4]
console.log(jumlah);  // 15` },

    { keys:['fetch','api','http','request','ajax'], build: () => `async function ambilData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.error("Gagal:", err.message);
    return null;
  }
}

ambilData("https://jsonplaceholder.typicode.com/users")
  .then(data => console.log(data));` },

    { keys:['dom','elemen','klik','event','button'], build: () => `const btn = document.getElementById("btn");
const out = document.getElementById("out");
let count = 0;

btn.addEventListener("click", () => {
  count++;
  out.textContent = "Diklik " + count + " kali";
});` },

    { keys:['async','await','promise','asynchronous'], build: () => `function tunda(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function urutan() {
  console.log("Mulai");
  await tunda(1000);
  console.log("Setelah 1 detik");
  await tunda(1000);
  console.log("Setelah 2 detik");
}

urutan();` },

    { keys:['rekursi','recursion','faktorial'], build: () => `function faktorial(n) {
  if (n <= 1) return 1;
  return n * faktorial(n - 1);
}

console.log(faktorial(5)); // 120` },

    { keys:['json','parse','stringify'], build: () => `const obj = { nama: "Andi", umur: 25 };

const jsonStr = JSON.stringify(obj);
console.log(jsonStr); // '{"nama":"Andi","umur":25}'

const parsed = JSON.parse(jsonStr);
console.log(parsed.nama); // Andi` },

    { default:true, keys:['hello','dasar','halo'], build: () => `console.log("Halo dari Deepz AI!");
console.log("JavaScript berjalan.");` }
  ]);

  /* ---------- CPP ---------- */
  learnCode('cpp', [
    { keys:['fungsi','function','tambah','hitung'], build: () => `#include <iostream>
using namespace std;

int tambah(int a, int b) {
    return a + b;
}

int main() {
    cout << "Hasil: " << tambah(5, 3) << endl;
    return 0;
}` },

    { keys:['loop','perulangan','for','while','iterasi'], build: () => `#include <iostream>
using namespace std;

int main() {
    for (int i = 1; i <= 5; i++) {
        cout << "Hitungan ke-" << i << endl;
    }
    return 0;
}` },

    { keys:['class','kelas','oop','objek'], build: () => `#include <iostream>
using namespace std;

class Mobil {
private:
    string nama;
    int kecepatan;
public:
    Mobil(string n, int k) : nama(n), kecepatan(k) {}
    void info() {
        cout << nama << " melaju " << kecepatan << " km/jam" << endl;
    }
};

int main() {
    Mobil m("Avanza", 120);
    m.info();
    return 0;
}` },

    { keys:['array','vektor','vector','list'], build: () => `#include <iostream>
using namespace std;

int main() {
    int angka[5] = {10, 20, 30, 40, 50};
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total += angka[i];
    }
    cout << "Total: " << total << endl;
    return 0;
}` },

    { keys:['input','masukan','cin','baca'], build: () => `#include <iostream>
using namespace std;

int main() {
    string nama;
    int umur;
    cout << "Nama: "; getline(cin, nama);
    cout << "Umur: "; cin >> umur;
    cout << "Halo " << nama << ", umur " << umur << endl;
    return 0;
}` },

    { keys:['file','baca','tulis','ifstream','ofstream'], build: () => `#include <iostream>
#include <fstream>
using namespace std;

int main() {
    ofstream out("data.txt");
    out << "Halo dari C++" << endl;
    out.close();

    ifstream in("data.txt");
    string baris;
    while (getline(in, baris)) {
        cout << baris << endl;
    }
    in.close();
    return 0;
}` },

    { keys:['rekursi','recursion','faktorial'], build: () => `#include <iostream>
using namespace std;

int faktorial(int n) {
    if (n <= 1) return 1;
    return n * faktorial(n - 1);
}

int main() {
    cout << "5! = " << faktorial(5) << endl;
    return 0;
}` },

    { default:true, keys:['hello','dasar','halo'], build: () => `#include <iostream>
using namespace std;

int main() {
    cout << "Halo, Dunia!" << endl;
    return 0;
}` }
  ]);

  /* ---------- XML ---------- */
  learnCode('xml', [
    { keys:['config','konfigurasi','setting','pengaturan'], build: () => `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <app>
    <name>MyApp</name>
    <version>1.0.0</version>
    <debug>false</debug>
  </app>
  <database>
    <host>localhost</host>
    <port>3306</port>
    <user>root</user>
    <password>secret</password>
  </database>
</config>` },

    { keys:['rss','feed','berita'], build: () => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog</title>
    <link>https://example.com</link>
    <description>Berita terbaru.</description>
    <item>
      <title>Artikel Pertama</title>
      <link>https://example.com/1</link>
    </item>
  </channel>
</rss>` },

    { keys:['android','layout','ui'], build: () => `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="24dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Halo, Deepz AI"
        android:textSize="20sp" />

    <Button
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Klik Saya" />
</LinearLayout>` },

    { keys:['sitemap','seo','google'], build: () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-01-01</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-01-01</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>` },

    { keys:['pom','maven','java','dependency'], build: () => `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.10.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>` },

    { default:true, keys:['data','struktur','daftar'], build: () => `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <user id="1">
    <nama>Andi</nama>
    <email>andi@mail.com</email>
  </user>
  <user id="2">
    <nama>Budi</nama>
    <email>budi@mail.com</email>
  </user>
</data>` }
  ]);

  /* =========================================================
     PUBLIC API
     ========================================================= */
  const API = {
    version: VERSION,
    pipeline: () => PIPELINE.slice(),
    ask,
    askSync,
    think,
    search: q => search(think(q)),
    learn: {
      knowledge: learnKnowledge,
      synonyms: learnSynonyms,
      code: learnCode
    },
    stats,
    resetMemory: () => { state.MEMORY.length = 0; }
  };

  global.DeepzAI = API;

  /* auto-info di console */
  try {
    if (typeof console !== 'undefined') {
      const s = stats();
      console.log(
        '%cDeepz AI v' + s.version + ' siap%c\n' +
        'Pipeline: ' + PIPELINE.join(' → ') + '\n' +
        'KB: ' + s.entries + ' entri · ' +
        s.synonyms + ' sinonim · ' +
        s.codeTemplates + ' template kode (' + s.codeLanguages.join(', ') + ')\n' +
        'Kategori: ' + Object.keys(s.categories).length + ' topik\n' +
        'Coba: DeepzAI.askSync("apa itu fotosintesis")',
        'color:#3b82f6;font-weight:bold;font-size:14px',
        'color:#666'
      );
    }
  } catch (e) {}

})(typeof window !== 'undefined' ? window : globalThis);
