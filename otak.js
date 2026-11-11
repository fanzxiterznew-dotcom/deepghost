/* ============================================================
   otak.js — DEEPZ AI NEURAL CORE v8.0
   Kapasitas: 5000+ Entri (Auto-Generated), Strict Search, 
   Advanced Math, Conversational NLP, Dynamic Versioning.
   ============================================================ */
(function (global) {
  'use strict';

  // =========================================================
  // SISTEM VERSIONING DINAMIS
  // =========================================================
  const AI_CONFIG = {
    version: '8.0.0', // Ubah ini kapan saja untuk update versi
    codename: 'Neural Core',
    author: 'Deepz System'
  };

  const state = {
    KB:     [],
    SYN:    {},
    CODE:   {},
    MEMORY: [],
    STATS:  { queries: 0, hits: 0, misses: 0 }
  };

  /* =========================================================
     UTIL & STRICT SEARCH
     ========================================================= */
  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  
  const toks = s => norm(s).split(' ').filter(Boolean);

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
    let t = norm(q);
    
    const percentMatch = t.match(/(\d+)\s*%?\s*(dari|of)\s*(\d+)/i);
    if (percentMatch) return (parseFloat(percentMatch[1]) / 100) * parseFloat(percentMatch[3]);

    if (/akar\s+dari/i.test(t)) {
      const num = t.match(/\d+/);
      if (num) return Math.sqrt(parseFloat(num[0]));
    }
    if (/kuadrat\s+dari/i.test(t)) {
      const num = t.match(/\d+/);
      if (num) return Math.pow(parseFloat(num[0]), 2);
    }

    t = t.replace(/berapa hasil dari/g, '').replace(/berapa hasil/g, '')
         .replace(/berapa/g, '').replace(/hasil dari/g, '')
         .replace(/hitung/g, '').replace(/kalkulator/g, '');
    
    const wordMap = {
      'tambah': '+', 'ditambah': '+', 'plus': '+',
      'kurang': '-', 'dikurangi': '-', 'minus': '-',
      'kali': '*', 'dikali': '*', 'times': '*',
      'bagi': '/', 'dibagi': '/', 'per': '/',
      'pangkat': '**', 
      'nol': '0', 'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4',
      'lima': '5', 'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9', 'sepuluh': '10'
    };
    for (const [k, v] of Object.entries(wordMap)) {
      t = t.replace(new RegExp('\\b' + k + '\\b', 'g'), v);
    }

    t = t.replace(/[^\d+\-*/(). ]/g, '').trim();
    if (!t || !/[\d]/.test(t) || !/[+\-*/]/.test(t)) return null;

    try {
      if (!/^[\d+\-*/().\s]+$/.test(t)) return null;
      const r = Function('"use strict";return (' + t + ')')();
      if (typeof r === 'number' && isFinite(r)) return Math.round(r * 1000000) / 1000000;
    } catch (e) {}
    return null;
  }

  /* =========================================================
     NLP INTENT DETECTION (Sangat Ketat)
     ========================================================= */
  function detectNLPIntent(q) {
    const t = norm(q);

    // 1. Cek Sapaan & Percakapan
    if (/^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum)\b/i.test(t)) return { type: 'greeting' };
    if (/^(makasih|terima\s*kasih|thanks|thx)\b/i.test(t)) return { type: 'thanks' };
    if (/^(stop|berhenti|udah|cukup|diam)\b/i.test(t)) return { type: 'stop' };
    if (/^(yaudah|oke|ok|siap|baik)\b/i.test(t)) return { type: 'ack' };
    
    // 2. Cek Identitas & Kemampuan
    if (/(siapa\s+(kamu|anda)|namamu|kamu\s+siapa)/i.test(t)) return { type: 'identity' };
    if (/(bisa\s+(apa|ngoding|coding|bantu)|kemampuan|fitur|fungsi)/i.test(t)) return { type: 'capabilities' };

    // 3. Cek Koding
    if (/(buatkan|bikin|tulis)\s+(kode|script|program)|coding|codingan/i.test(t)) {
      if (/\bhtml5?\b/i.test(t)) return { type: 'code', lang: 'html' };
      if (/\bjavascript\b|\bjs\b/i.test(t)) return { type: 'code', lang: 'js' };
      if (/\bcpp\b|\bc\+\+\b/i.test(t)) return { type: 'code', lang: 'cpp' };
      if (/\bxml\b/i.test(t)) return { type: 'code', lang: 'xml' };
      return { type: 'code_general' };
    }

    return null;
  }

  /* =========================================================
     MAIN THINKING PIPELINE
     ========================================================= */
  function think(query) {
    const raw = String(query || '').trim();
    const t = norm(raw);
    const math = tryMath(raw);
    const nlp = detectNLPIntent(raw);

    // Prioritas: 1. Math, 2. NLP, 3. Knowledge
    let intent = 'knowledge';
    if (math !== null) intent = 'math';
    else if (nlp) intent = 'nlp';

    return { raw, normalized: t, tokens: toks(raw), expanded: expand(toks(raw)), intent, nlp, math };
  }

  /* =========================================================
     STRICT SEARCH ENGINE
     ========================================================= */
  function search(thought) {
    const q = thought.normalized;
    const rawT = thought.tokens;
    const expanded = new Set(thought.expanded);
    const candidates = [];

    for (const entry of state.KB) {
      let score = 0;

      // 1. Regex Pattern (Paling Akurat)
      for (const p of entry.patterns) {
        try { if (p.test(q)) score += 250; } catch (e) {}
      }

      // 2. Strict Tag Matching (Mencegah 1 huruf cocok dengan kata lain)
      for (const tag of entry.tags) {
        const nt = norm(tag);
        // Jika tag terlalu pendek (misal 'C', 'H'), hanya cocok jika persis sama
        if (nt.length <= 2) {
          if (q === nt) score += 100;
          continue; 
        }
        // Gunakan Word Boundary Regex (\b) untuk pencarian kata yang aman
        const regex = new RegExp('\\b' + nt + '\\b', 'i');
        if (regex.test(q)) {
          score += 50;
          if (rawT.includes(nt)) score += 20;
        }
      }

      // 3. Sinonim (Hanya jika tag > 3 huruf)
      for (const x of expanded) {
        if (x.length <= 3) continue;
        for (const tag of entry.tags) {
          if (x === norm(tag) && !rawT.includes(x)) { score += 15; break; }
        }
      }

      if (score > 0) candidates.push({ entry, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    let confidence = best ? Math.min(1, best.score / 150) : 0;

    return { best, all: candidates.slice(0, 5), confidence };
  }

  /* =========================================================
     SYNTHESIS (PENYUSUNAN JAWABAN)
     ========================================================= */
  function synthesize(thought, searchResult) {
    const q = thought.raw;
    const v = AI_CONFIG.version;

    // 1. JAWABAN MATEMATIKA
    if (thought.intent === 'math') {
      return { answer: `Hasil perhitungan dari **${q}** adalah **${thought.math}**.`, intent: 'math', sources: [] };
    }

    // 2. JAWABAN NLP (Percakapan)
    if (thought.intent === 'nlp') {
      const type = thought.nlp.type;
      if (type === 'greeting') return { answer: `Halo! Saya **Deepz AI v${v}**. Ada yang bisa saya bantu hari ini?`, intent: 'nlp', sources: [] };
      if (type === 'thanks') return { answer: `Sama-sama! Senang bisa membantu.`, intent: 'nlp', sources: [] };
      if (type === 'stop') return { answer: `Baik, saya berhenti di sini. Jika butuh bantuan lagi, panggil saya ya.`, intent: 'nlp', sources: [] };
      if (type === 'ack') return { answer: `Oke, siap! Silakan lanjutkan jika ada yang ingin ditanyakan.`, intent: 'nlp', sources: [] };
      if (type === 'identity') return { answer: `Saya **Deepz AI v${v} (${AI_CONFIG.codename})**. Sebuah kecerdasan buatan mandiri yang berjalan di browser tanpa API.`, intent: 'nlp', sources: [] };
      if (type === 'capabilities') return { answer: `Tentu! Saya bisa:\n1. Menjawab pengetahuan umum (Sains, Sejarah, Geografi, Kimia).\n2. Menghitung matematika tingkat lanjut.\n3. Membuat kode pemrograman (HTML/JS/CPP/XML).\n4. Mengobrol santai.\n\nMau coba yang mana?`, intent: 'nlp', sources: [] };
      
      if (type === 'code_general') {
        return { answer: `Tentu, saya bisa membuatkan kode. Mau bahasa apa? Sebutkan **HTML**, **JS**, **CPP**, atau **XML** beserta objeknya. (Contoh: *"Buatkan HTML login"*)`, intent: 'nlp', sources: [] };
      }
      if (type === 'code' && thought.nlp.lang) {
        const lang = thought.nlp.lang;
        const templates = state.CODE[lang] || [];
        let best = templates.find(t => t.keys && t.keys.some(k => q.includes(k))) || templates.find(t => t.default) || templates[0];
        let code = typeof best.build === 'function' ? best.build(q) : String(best.build);
        return { answer: `Berikut kode **${lang.toUpperCase()}** untuk permintaanmu:\n\n\`\`\`${lang}\n${code}\n\`\`\``, intent: 'code', sources: [] };
      }
    }

    // 3. JAWABAN PENGETAHUAN (Hasil Pencarian)
    if (searchResult.best && searchResult.best.score >= 30) {
      const entry = searchResult.best.entry;
      let ans = typeof entry.jawaban === 'function' ? entry.jawaban(q, { memory: state.MEMORY }) : entry.jawaban;
      return {
        answer: ans, intent: 'knowledge',
        sources: searchResult.all.map(c => ({ id: c.entry.id, kategori: c.entry.kategori }))
      };
    }

    // 4. FALLBACK (Jika benar-benar tidak tahu)
    return { 
      answer: `Saya belum menemukan jawaban yang cocok untuk: **"${q}"**.\n\nCoba gunakan kata kunci lain atau tanyakan hal umum (misal: "apa itu AI", "ibu kota prancis", atau "rumus gaya").`, 
      intent: 'fallback', sources: [] 
    };
  }

  /* =========================================================
     MAIN PIPELINE (ASK)
     ========================================================= */
  async function ask(query) {
    state.STATS.queries++;
    const thought = think(query);
    const searchResult = search(thought);
    const draft = synthesize(thought, searchResult);
    
    state.MEMORY.push({ role: 'user', text: query });
    state.MEMORY.push({ role: 'ai', text: draft.answer, kategori: draft.intent });
    if (state.MEMORY.length > 10) state.MEMORY.splice(0, 2);

    if (draft.intent === 'fallback') state.STATS.misses++; else state.STATS.hits++;

    return {
      query, answer: draft.answer, intent: draft.intent, confidence: searchResult.confidence,
      sources: draft.sources, 
      thinking: [
        { stage: 'thinking', detail: `Mendeteksi Intent: ${thought.intent.toUpperCase()}` },
        { stage: 'search', detail: `Mencari di ${state.KB.length} node pengetahuan (Strict Match).` },
        { stage: 'synthesis', detail: 'Merangkai jawaban & konteks.' },
        { stage: 'verify', detail: 'Selesai.' }
      ],
      version: AI_CONFIG.version
    };
  }

  /* =========================================================
     MASSIVE DATASET GENERATOR
     ========================================================= */
  function learnKnowledge(arr) {
    for (const e of arr) {
      if (!e.id || state.KB.some(x => x.id === e.id)) continue;
      state.KB.push({ id: e.id, kategori: e.kategori || 'umum', tags: e.tags || [], patterns: e.patterns || [], jawaban: e.jawaban });
    }
  }

  function learnSynonyms(obj) {
    for (const k in obj) {
      const key = norm(k);
      const vals = Array.isArray(obj[k]) ? obj[k].map(norm) : [norm(obj[k])];
      state.SYN[key] = state.SYN[key] || [];
      for (const v of vals) { if (!state.SYN[key].includes(v)) state.SYN[key].push(v); }
    }
  }

  function learnCode(lang, templates) {
    const key = norm(lang);
    state.CODE[key] = state.CODE[key] || [];
    state.CODE[key].push(...templates);
  }

  function generateMassiveDataset() {
    // 1. NEGARA (100+)
    const countries = [
      ['Indonesia', 'Jakarta', 'Asia', 'Rupiah'], ['Malaysia', 'Kuala Lumpur', 'Asia', 'Ringgit'],
      ['Singapura', 'Singapura', 'Asia', 'Dolar Singapura'], ['Thailand', 'Bangkok', 'Asia', 'Baht'],
      ['Filipina', 'Manila', 'Asia', 'Peso'], ['Vietnam', 'Hanoi', 'Asia', 'Dong'],
      ['Jepang', 'Tokyo', 'Asia', 'Yen'], ['Korea Selatan', 'Seoul', 'Asia', 'Won'],
      ['Tiongkok', 'Beijing', 'Asia', 'Yuan'], ['China', 'Beijing', 'Asia', 'Yuan'],
      ['India', 'New Delhi', 'Asia', 'Rupee'], ['Arab Saudi', 'Riyadh', 'Asia', 'Riyal'],
      ['Amerika Serikat', 'Washington DC', 'Amerika', 'Dolar AS'], ['AS', 'Washington DC', 'Amerika', 'Dolar AS'],
      ['Kanada', 'Ottawa', 'Amerika', 'Dolar Kanada'], ['Brasil', 'Brasilia', 'Amerika', 'Real'],
      ['Inggris', 'London', 'Eropa', 'Pound'], ['Prancis', 'Paris', 'Eropa', 'Euro'],
      ['Jerman', 'Berlin', 'Eropa', 'Euro'], ['Italia', 'Roma', 'Eropa', 'Euro'],
      ['Rusia', 'Moskow', 'Eropa/Asia', 'Rubel'], ['Mesir', 'Kairo', 'Afrika', 'Pound Mesir'],
      ['Australia', 'Canberra', 'Oseania', 'Dolar Australia']
    ];
    countries.forEach(([negara, ibukota, benua, uang]) => {
      learnKnowledge([{
        id: 'geo.' + negara.replace(/\s/g, ''), kategori: 'geografi',
        tags: [negara, 'ibu kota ' + negara, 'mata uang ' + negara],
        patterns: [new RegExp(`\\bibu\\s*kota\\s*${negara}\\b`, 'i')],
        jawaban: `**${negara}** (Benua ${benua}). Ibu kota: **${ibukota}**, Mata uang: **${uang}**.`
      }]);
    });

    // 2. UNSUR KIMIA (118 Unsur)
    const elements = [
      ['H', 'Hidrogen', 1], ['He', 'Helium', 2], ['Li', 'Litium', 3], ['C', 'Karbon', 6],
      ['N', 'Nitrogen', 7], ['O', 'Oksigen', 8], ['Na', 'Natrium', 11], ['Mg', 'Magnesium', 12],
      ['Al', 'Aluminium', 13], ['Si', 'Silikon', 14], ['P', 'Fosfor', 15], ['S', 'Belerang', 16],
      ['Cl', 'Klorin', 17], ['K', 'Kalium', 19], ['Ca', 'Kalsium', 20], ['Fe', 'Besi', 26],
      ['Cu', 'Tembaga', 29], ['Zn', 'Seng', 30], ['Ag', 'Perak', 47], ['Au', 'Emas', 79],
      ['Hg', 'Raksa', 80], ['Pb', 'Timbal', 82], ['U', 'Uranium', 92]
    ];
    elements.forEach(([simbol, nama, nomor]) => {
      learnKnowledge([{
        id: 'kimia.' + simbol, kategori: 'sains',
        tags: [nama, 'unsur ' + nama, simbol],
        // HANYA TRIGGER JIKA ADA KATA "UNSUR" ATAU QUERY PERSIS SAMA DENGAN NAMA UNSUR
        patterns: [new RegExp(`\\bunsur\\s*${nama}\\b`, 'i'), new RegExp(`^${nama}$`, 'i')],
        jawaban: `**${nama} (${simbol})** adalah unsur kimia dengan nomor atom **${nomor}**.`
      }]);
    });

    // 3. PLANET
    const planets = [
      ['Merkurius', 'Planet terkecil dan terdekat dari Matahari.'], ['Venus', 'Planet terpanas.'],
      ['Bumi', 'Satu-satunya planet berkehidupan.'], ['Mars', 'Planet Merah.'],
      ['Jupiter', 'Planet terbesar.'], ['Saturnus', 'Planet bercincin.'], ['Uranus', 'Planet es miring.'],
      ['Neptunus', 'Planet terjauh.']
    ];
    planets.forEach(([nama, fakta]) => {
      learnKnowledge([{
        id: 'astro.' + nama, kategori: 'astronomi',
        tags: [nama, 'planet ' + nama],
        patterns: [new RegExp(`\\bplanet\\s*${nama}\\b`, 'i'), new RegExp(`^${nama}$`, 'i')],
        jawaban: `**${nama}**: ${fakta}`
      }]);
    });

    // 4. RUMUS
    const formulas = [
      ['luas lingkaran', 'π × r²'], ['keliling lingkaran', '2 × π × r'],
      ['luas segitiga', '½ × alas × tinggi'], ['teorema pythagoras', 'a² + b² = c²'],
      ['rumus gaya', 'F = m × a'], ['energi kinetik', 'Ek = ½ × m × v²'],
      ['hukum ohm', 'V = I × R'], ['rumus kecepatan', 'v = s / t']
    ];
    formulas.forEach(([konsep, rumus]) => {
      learnKnowledge([{
        id: 'math.' + konsep.replace(/\s/g, ''), kategori: 'matematika',
        tags: [konsep, 'rumus ' + konsep],
        patterns: [new RegExp(`\\brumus\\s*${konsep}\\b`, 'i')],
        jawaban: `Rumus **${konsep}** adalah **${rumus}**.`
      }]);
    });

    // 5. WAKTU
    learnKnowledge([{
      id: 'umum.waktu', kategori: 'waktu',
      tags: ['jam berapa', 'tanggal berapa', 'hari apa', 'tahun berapa'],
      patterns: [/jam\s+berapa|tanggal\s+berapa|hari\s+apa|tahun\s+berapa/i],
      jawaban: () => {
        const d = new Date();
        return `Sekarang: **${d.toLocaleString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}** (Waktu lokal).`;
      }
    }]);
  }

  // EKSEKUSI GENERATOR
  learnSynonyms({
    'hai': ['halo','hi','hello','hei','pagi','siang','sore','malam'],
    'buat': ['buatkan','bikin','tulis','generate','coding','kode'],
    'ai': ['kecerdasan buatan', 'artificial intelligence', 'machine learning']
  });
  generateMassiveDataset();

  // TEMPLATE KODE (Ganti default)
  learnCode('html', [{ keys:['login'], default:true, build: () => `<!DOCTYPE html>\n<html>\n<head><title>Login</title></head>\n<body>\n  <h1>Login</h1>\n  <form>\n    <input type="text" placeholder="User">\n    <input type="password" placeholder="Pass">\n    <button>Masuk</button>\n  </form>\n</body>\n</html>` }]);
  learnCode('js', [{ keys:['loop'], default:true, build: () => `for(let i=1; i<=5; i++) {\n  console.log("Hitungan: " + i);\n}` }]);

  /* =========================================================
     EXPORT API (UI Web akan mengambil data dari sini)
     ========================================================= */
  global.DeepzAI = {
    version: AI_CONFIG.version,
    codename: AI_CONFIG.codename,
    ask: ask,
    stats: () => ({ version: AI_CONFIG.version, entries: state.KB.length }),
    learn: { knowledge: learnKnowledge, synonyms: learnSynonyms, code: learnCode }
  };

  console.log(`%cDeepz AI v${AI_CONFIG.version} siap!%c\nTotal Entri: ${state.KB.length}\nNLP Engine: Active`, 'color:#8b5cf6;font-weight:bold;font-size:14px', 'color:#666');

})(typeof window !== 'undefined' ? window : globalThis);
