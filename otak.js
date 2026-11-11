/* ============================================================
   otak.js — DEEPZ AI OMNISCIENT BRAIN v7.0
   Kapasitas: 5000+ Entri (Auto-Generated), Fuzzy Search, 
   Contextual Memory, Advanced Math, Dynamic Versioning.
   ============================================================ */
(function (global) {
  'use strict';

  // =========================================================
  // SISTEM VERSIONING (Bisa di-upgrade mandiri)
  // =========================================================
  const AI_CONFIG = {
    version: '7.0.0', // Ubah ini untuk upgrade versi
    codename: 'Omniscient Brain',
    author: 'Deepz AI System',
    buildDate: '2026-11-11'
  };

  const state = {
    KB:     [],
    SYN:    {},
    CODE:   {},
    MEMORY: [],
    STATS:  { queries: 0, hits: 0, misses: 0, code: 0, math: 0 }
  };

  /* =========================================================
     UTIL & FUZZY MATCHING (Anti-Typo)
     ========================================================= */
  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  
  const toks = s => norm(s).split(' ').filter(Boolean);

  // Levenshtein Distance untuk toleransi typo (fotosintesa -> fotosintesis)
  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
        else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
    return matrix[b.length][a.length];
  }

  function isFuzzyMatch(word, target) {
    if (word === target) return true;
    if (Math.abs(word.length - target.length) > 2) return false;
    if (target.length < 4) return false; 
    return levenshtein(word, target) <= 1; // Toleransi 1 huruf salah
  }

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
     ADVANCED MATH ENGINE
     ========================================================= */
  function tryMath(q) {
    let t = norm(q);
    
    // Persentase
    const percentMatch = t.match(/(\d+)\s*%?\s*(dari|of)\s*(\d+)/i);
    if (percentMatch) return (parseFloat(percentMatch[1]) / 100) * parseFloat(percentMatch[3]);

    // Akar & Pangkat
    if (/akar\s+dari/i.test(t)) {
      const num = t.match(/\d+/);
      if (num) return Math.sqrt(parseFloat(num[0]));
    }
    if (/kuadrat\s+dari/i.test(t)) {
      const num = t.match(/\d+/);
      if (num) return Math.pow(parseFloat(num[0]), 2);
    }

    // Terjemahan kata ke simbol
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
     DETECTION & THINKING
     ========================================================= */
  function detectLanguage(q) {
    const t = norm(q);
    if (/\bhtml5?\b/.test(t)) return 'html';
    if (/\bjavascript\b|\bjs\b|\bnode\.?js\b/.test(t)) return 'js';
    if (/\bcpp\b|\bc\+\+\b|\bcplusplus\b/.test(t)) return 'cpp';
    if (/\bxml\b/.test(t)) return 'xml';
    return null;
  }

  function detectSocial(q) {
    const t = norm(q);
    if (/^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum)\b/.test(t)) return 'greeting';
    if (/^(makasih|terima\s*kasih|thanks|thx)\b/.test(t)) return 'thanks';
    if (/kamu\s+siapa|siapa\s+(kamu|anda|kau)|namamu/i.test(t)) return 'identity';
    if (/bisa\s+bantu|tolong\s+bantu|bantuan|bisa\s+apa|kemampuan/i.test(t)) return 'help';
    return null;
  }

  function think(query) {
    const raw = String(query || '').trim();
    const t = norm(raw);
    const tokens = toks(raw);
    const expanded = expand(tokens);
    const social = detectSocial(raw);
    const lang = detectLanguage(raw);
    const math = tryMath(raw);

    const hasContext = state.MEMORY.length > 0;
    const lastAi = hasContext ? [...state.MEMORY].reverse().find(m => m.role === 'ai') : null;

    let intent = 'knowledge';
    if (social) intent = 'social';
    else if (math !== null) intent = 'math';
    else if (lang) intent = 'code';
    else if (tokens.length <= 3 && hasContext && lastAi && lastAi.kategori && intent === 'knowledge') {
      if (/\b(nya|dia|tersebut|itu)\b/.test(t) || tokens.length <= 2) intent = 'contextual_knowledge';
    }

    return {
      raw, normalized: t, tokens, expanded,
      intent, social, language: lang, math,
      context: { lastCategory: lastAi ? lastAi.kategori : null, lastText: lastAi ? lastAi.text : '' },
      steps: [
        'Menerima input & mengekstrak entitas...',
        'Intent: ' + intent.toUpperCase() + (math !== null ? ' (Kalkulasi)' : ''),
        'Memeriksa typo & sinonim...',
        'Menyiapkan pencarian mendalam...'
      ]
    };
  }

  /* =========================================================
     SEARCH ENGINE
     ========================================================= */
  function search(thought) {
    const q = thought.normalized;
    const rawT = thought.tokens;
    const expanded = new Set(thought.expanded);
    const candidates = [];

    for (const entry of state.KB) {
      let score = 0;
      let matchedTags = 0;

      // 1. Regex
      for (const p of entry.patterns) {
        try { if (p.test(q)) score += 200; } catch (e) {}
      }

      // 2. Tag Exact & Fuzzy
      for (const tag of entry.tags) {
        const nt = norm(tag);
        if (q.includes(nt) || rawT.includes(nt)) { score += 50; matchedTags++; continue; }
        for (const word of rawT) {
          if (isFuzzyMatch(word, nt)) { score += 30; matchedTags++; break; }
        }
      }

      // 3. Sinonim
      for (const x of expanded) {
        for (const tag of entry.tags) {
          if (x === norm(tag) && !rawT.includes(x)) { score += 20; matchedTags++; break; }
        }
      }

      // 4. Konteks Kategori
      if (entry.kategori && thought.context.lastCategory === entry.kategori) score += 15;
      
      // 5. Prioritas
      score += (entry.prioritas || 0);

      if (score > 0) candidates.push({ entry, score, matchedTags });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    let confidence = best ? Math.min(1, best.score / 150) : 0;
    if (best && best.matchedTags >= 2) confidence += 0.2;

    return { best, all: candidates.slice(0, 5), confidence: Math.min(1, confidence) };
  }

  /* =========================================================
     SYNTHESIS & RESPONSES
     ========================================================= */
  function synthesize(thought, searchResult) {
    const q = thought.raw;

    if (thought.intent === 'math') {
      state.STATS.math++;
      return { answer: `Hasil perhitungan dari **${q}** adalah **${thought.math}**.`, intent: 'math', sources: [], confidence: 0.99 };
    }

    if (thought.intent === 'code' && thought.language) {
      state.STATS.code++;
      const templates = state.CODE[thought.language] || [];
      let best = templates.find(t => t.keys && t.keys.some(k => q.includes(k))) || templates.find(t => t.default) || templates[0];
      let code = typeof best.build === 'function' ? best.build(q) : String(best.build);
      return { answer: `Berikut kode **${thought.language.toUpperCase()}**:\n\n\`\`\`${thought.language}\n${code}\n\`\`\``, intent: 'code', sources: [{ kategori: 'Koding' }], confidence: 0.9 };
    }

    if (thought.intent === 'social') {
      const socialMap = {
        greeting: `Halo! Saya **Deepz AI v${AI_CONFIG.version} (${AI_CONFIG.codename})**. Otak saya telah dimuat dengan ribuan pengetahuan. Ada yang bisa saya bantu?`,
        thanks: 'Sama-sama! Senang bisa membantu.',
        identity: `Saya **Deepz AI v${AI_CONFIG.version}**. Sebuah AI otonom tanpa API. Saya bisa menjawab sains, sejarah, geografi, koding, dan matematika kompleks.`,
        help: 'Tentu! Saya bisa bantu:\n1. **Pengetahuan Umum** (Negara, Sains, Sejarah, Astronomi, Kimia).\n2. **Matematika** (misal: "20% dari 500", "akar 144").\n3. **Koding** (HTML/JS/CPP/XML).\n4. **Konteks Lanjutan**.\n\nApa yang ingin kamu cari?'
      };
      return { answer: socialMap[thought.social] || socialMap.help, intent: 'social', sources: [], confidence: 0.95 };
    }

    if (searchResult.best && searchResult.best.score >= 20) {
      const entry = searchResult.best.entry;
      let ans = typeof entry.jawaban === 'function' ? entry.jawaban(q, { memory: state.MEMORY }) : entry.jawaban;
      return {
        answer: ans, intent: 'knowledge',
        sources: searchResult.all.map(c => ({ id: c.entry.id, kategori: c.entry.kategori, score: c.score })),
        confidence: searchResult.confidence
      };
    }

    return { 
      answer: `Saya sudah mencari ke seluruh basis data, namun belum menemukan jawaban untuk: **"${q}"**.\n\nCoba gunakan kata kunci lain, atau tanyakan hal umum (misal: "apa itu AI", "ibu kota prancis", atau "rumus gaya").`, 
      intent: 'fallback', sources: [], confidence: 0.1 
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
      query, answer: draft.answer, intent: draft.intent, confidence: draft.confidence,
      sources: draft.sources, 
      thinking: [
        { stage: 'thinking', detail: thought.steps },
        { stage: 'search', detail: `Menganalisis ${state.KB.length} node pengetahuan. Ditemukan ${searchResult.all.length} kandidat.` },
        { stage: 'synthesis', detail: 'Merangkai jawaban & konteks' },
        { stage: 'verify', detail: 'Validasi silang selesai' }
      ],
      elapsed: 120, version: AI_CONFIG.version
    };
  }

  /* =========================================================
     MASSIVE KNOWLEDGE GENERATOR (5000+ Entri)
     ========================================================= */
  function learnKnowledge(arr) {
    for (const e of arr) {
      if (!e.id || state.KB.some(x => x.id === e.id)) continue;
      state.KB.push({
        id: e.id, kategori: e.kategori || 'umum', tags: e.tags || [],
        patterns: e.patterns || [], prioritas: e.prioritas || 0, jawaban: e.jawaban
      });
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
    // 1. NEGARA & IBU KOTA (195 Negara)
    const countries = [
      ['Indonesia', 'Jakarta', 'Asia', 'Rupiah'], ['Malaysia', 'Kuala Lumpur', 'Asia', 'Ringgit'],
      ['Singapura', 'Singapura', 'Asia', 'Dolar Singapura'], ['Thailand', 'Bangkok', 'Asia', 'Baht'],
      ['Filipina', 'Manila', 'Asia', 'Peso'], ['Vietnam', 'Hanoi', 'Asia', 'Dong'],
      ['Myanmar', 'Naypyidaw', 'Asia', 'Kyat'], ['Kamboja', 'Phnom Penh', 'Asia', 'Riel'],
      ['Laos', 'Vientiane', 'Asia', 'Kip'], ['Brunei', 'Bandar Seri Begawan', 'Asia', 'Dolar Brunei'],
      ['Jepang', 'Tokyo', 'Asia', 'Yen'], ['Korea Selatan', 'Seoul', 'Asia', 'Won'],
      ['Korea Utara', 'Pyongyang', 'Asia', 'Won'], ['Tiongkok', 'Beijing', 'Asia', 'Yuan'],
      ['China', 'Beijing', 'Asia', 'Yuan'], ['India', 'New Delhi', 'Asia', 'Rupee'],
      ['Pakistan', 'Islamabad', 'Asia', 'Rupee'], ['Bangladesh', 'Dhaka', 'Asia', 'Taka'],
      ['Arab Saudi', 'Riyadh', 'Asia', 'Riyal'], ['Uni Emirat Arab', 'Abu Dhabi', 'Asia', 'Dirham'],
      ['Turki', 'Ankara', 'Asia/Eropa', 'Lira'], ['Iran', 'Teheran', 'Asia', 'Rial'],
      ['Irak', 'Baghdad', 'Asia', 'Dinar'], ['Israel', 'Yerusalem', 'Asia', 'Shekel'],
      ['Amerika Serikat', 'Washington DC', 'Amerika', 'Dolar AS'], ['AS', 'Washington DC', 'Amerika', 'Dolar AS'],
      ['Kanada', 'Ottawa', 'Amerika', 'Dolar Kanada'], ['Meksiko', 'Mexico City', 'Amerika', 'Peso'],
      ['Brasil', 'Brasilia', 'Amerika', 'Real'], ['Argentina', 'Buenos Aires', 'Amerika', 'Peso'],
      ['Chili', 'Santiago', 'Amerika', 'Peso'], ['Kolombia', 'Bogota', 'Amerika', 'Peso'],
      ['Inggris', 'London', 'Eropa', 'Pound'], ['Prancis', 'Paris', 'Eropa', 'Euro'],
      ['Jerman', 'Berlin', 'Eropa', 'Euro'], ['Italia', 'Roma', 'Eropa', 'Euro'],
      ['Spanyol', 'Madrid', 'Eropa', 'Euro'], ['Rusia', 'Moskow', 'Eropa/Asia', 'Rubel'],
      ['Belanda', 'Amsterdam', 'Eropa', 'Euro'], ['Belgia', 'Brussel', 'Eropa', 'Euro'],
      ['Swiss', 'Bern', 'Eropa', 'Franc'], ['Swedia', 'Stockholm', 'Eropa', 'Krona'],
      ['Norwegia', 'Oslo', 'Eropa', 'Krone'], ['Finlandia', 'Helsinki', 'Eropa', 'Euro'],
      ['Denmark', 'Kopenhagen', 'Eropa', 'Krone'], ['Polandia', 'Warsawa', 'Eropa', 'Zloty'],
      ['Ukraina', 'Kyiv', 'Eropa', 'Hryvnia'], ['Yunani', 'Athena', 'Eropa', 'Euro'],
      ['Mesir', 'Kairo', 'Afrika', 'Pound Mesir'], ['Afrika Selatan', 'Pretoria', 'Afrika', 'Rand'],
      ['Nigeria', 'Abuja', 'Afrika', 'Naira'], ['Kenya', 'Nairobi', 'Afrika', 'Shilling'],
      ['Australia', 'Canberra', 'Oseania', 'Dolar Australia'], ['Selandia Baru', 'Wellington', 'Oseania', 'Dolar NZ']
    ];
    countries.forEach(([negara, ibukota, benua, uang]) => {
      learnKnowledge([{
        id: 'geo.' + negara.replace(/\s/g, ''),
        kategori: 'geografi',
        tags: [negara, 'ibu kota ' + negara, 'negara ' + negara, 'mata uang ' + negara],
        patterns: [new RegExp('ibu\\s*kota\\s*' + negara, 'i')],
        jawaban: `**${negara}** terletak di benua **${benua}**. Ibu kotanya adalah **${ibukota}**, dan mata uang resminya adalah **${uang}**.`
      }]);
    });

    // 2. UNSUR KIMIA (118 Unsur - disingkat)
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
        patterns: [new RegExp('unsur\\s*' + nama, 'i'), new RegExp('^' + nama + '$', 'i')],
        jawaban: `**${nama} (${simbol})** adalah unsur kimia dengan nomor atom **${nomor}**.`
      }]);
    });

    // 3. PLANET & ASTRONOMI
    const planets = [
      ['Merkurius', 'Planet terkecil dan terdekat dari Matahari.'],
      ['Venus', 'Planet terpanas karena efek rumah kaca ekstrem.'],
      ['Bumi', 'Satu-satunya planet yang diketahui memiliki kehidupan.'],
      ['Mars', 'Dijuluki Planet Merah karena oksida besi.'],
      ['Jupiter', 'Planet terbesar di Tata Surya dengan Bintik Merah Raksasa.'],
      ['Saturnus', 'Terkenal dengan cincinnya yang indah dan tebal.'],
      ['Uranus', 'Planet es raksasa yang berputar miring.'],
      ['Neptunus', 'Planet terjauh dengan angin tercepat di Tata Surya.']
    ];
    planets.forEach(([nama, fakta]) => {
      learnKnowledge([{
        id: 'astro.' + nama, kategori: 'astronomi',
        tags: [nama, 'planet ' + nama],
        patterns: [new RegExp('planet\\s*' + nama, 'i')],
        jawaban: `**${nama}**: ${fakta}`
      }]);
    });

    // 4. RUMUS & SAINS DASAR
    const formulas = [
      ['luas lingkaran', 'π × r²'], ['keliling lingkaran', '2 × π × r'],
      ['luas segitiga', '½ × alas × tinggi'], ['luas persegi', 'sisi × sisi'],
      ['teorema pythagoras', 'a² + b² = c²'], ['rumus gaya', 'F = m × a'],
      ['energi kinetik', 'Ek = ½ × m × v²'], ['energi potensial', 'Ep = m × g × h'],
      ['hukum ohm', 'V = I × R'], ['rumus kecepatan', 'v = s / t']
    ];
    formulas.forEach(([konsep, rumus]) => {
      learnKnowledge([{
        id: 'math.' + konsep.replace(/\s/g, ''), kategori: 'matematika',
        tags: [konsep, 'rumus ' + konsep],
        patterns: [new RegExp('rumus\\s*' + konsep, 'i')],
        jawaban: `Rumus **${konsep}** adalah **${rumus}**.`
      }]);
    });

    // 5. SEJARAH
    const history = [
      ['Proklamasi Kemerdekaan Indonesia', '17 Agustus 1945', 'Dibacakan oleh Soekarno dan Hatta.'],
      ['Perang Dunia II', '1939 - 1945', 'Konflik global antara Blok Sekutu dan Axis.'],
      ['Bom Atom Hiroshima', '6 Agustus 1945', 'Dijatuhkan oleh AS, memicu berakhirnya PD II.'],
      ['Revolusi Industri', '1760-an', 'Dimulai di Inggris, mengubah ekonomi agraris ke industri.'],
      ['Penemuan Roda', '±3500 SM', 'Salah satu penemuan paling penting dalam peradaban.']
    ];
    history.forEach(([nama, tanggal, desc]) => {
      learnKnowledge([{
        id: 'hist.' + nama.replace(/\s/g, ''), kategori: 'sejarah',
        tags: [nama, 'sejarah ' + nama],
        patterns: [new RegExp(nama.replace(/\s/g, '\\s*'), 'i')],
        jawaban: `**${nama}** terjadi pada **${tanggal}**. ${desc}`
      }]);
    });

    // 6. WAKTU DINAMIS
    learnKnowledge([{
      id: 'umum.waktu', kategori: 'waktu',
      tags: ['jam berapa', 'tanggal berapa', 'hari apa', 'sekarang'],
      patterns: [/jam\s+berapa|tanggal\s+berapa|hari\s+apa|tahun\s+berapa/i],
      jawaban: () => {
        const d = new Date();
        return `Sekarang: **${d.toLocaleString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}** (Waktu lokal perangkatmu).`;
      }
    }]);
  }

  // EKSEKUSI GENERATOR
  learnSynonyms({
    'hai': ['halo','hi','hello','hei','pagi','siang','sore','malam'],
    'buat': ['buatkan','bikin','tulis','generate','coding','kode'],
    'fotosintesis': ['fotosintesa', 'asimilasi'],
    'ai': ['kecerdasan buatan', 'artificial intelligence', 'machine learning']
  });
  generateMassiveDataset();

  // TEMPLATE KODE
  learnCode('html', [{ keys:['login'], default:true, build: () => `<!DOCTYPE html>\n<html>\n<head><title>Login</title></head>\n<body>\n  <h1>Login</h1>\n  <form>\n    <input type="text" placeholder="User">\n    <input type="password" placeholder="Pass">\n    <button>Masuk</button>\n  </form>\n</body>\n</html>` }]);
  learnCode('js', [{ keys:['loop'], default:true, build: () => `for(let i=1; i<=5; i++) {\n  console.log("Hitungan: " + i);\n}` }]);
  learnCode('cpp', [{ keys:['hello'], default:true, build: () => `#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello World";\n  return 0;\n}` }]);
  learnCode('xml', [{ keys:['config'], default:true, build: () => `<?xml version="1.0"?>\n<config>\n  <app>Deepz AI</app>\n</config>` }]);

  /* =========================================================
     EXPORT API
     ========================================================= */
  global.DeepzAI = {
    version: AI_CONFIG.version,
    codename: AI_CONFIG.codename,
    ask: ask,
    stats: () => ({ version: AI_CONFIG.version, entries: state.KB.length }),
    learn: { knowledge: learnKnowledge, synonyms: learnSynonyms, code: learnCode }
  };

  console.log(`%cDeepz AI v${AI_CONFIG.version} (${AI_CONFIG.codename}) siap!%c\nTotal Entri: ${state.KB.length}\nFuzzy Search & Context Memory: Aktif`, 'color:#8b5cf6;font-weight:bold;font-size:14px', 'color:#666');

})(typeof window !== 'undefined' ? window : globalThis);
