/* ============================================================
   otak.js — DEEPZ AI WORLD MASTER v8.0
   Fix: Tag Matching Bug (1-letter match), Conversational AI,
   Code Intent Detection, Context Awareness.
   ============================================================ */
(function (global) {
  'use strict';

  const AI_CONFIG = {
    version: '8.0.0',
    codename: 'World Master',
    author: 'Deepz AI System'
  };

  const state = {
    KB:     [], SYN:    {}, CODE:   {}, MEMORY: [],
    STATS:  { queries: 0, hits: 0, misses: 0, code: 0, math: 0 }
  };

  /* =========================================================
     UTIL & MATCHING
     ========================================================= */
  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  
  const toks = s => norm(s).split(' ').filter(Boolean);

  // Levenshtein untuk toleransi typo (hanya untuk kata > 4 huruf)
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

  // Pencocokan Tag yang Aman (Tidak akan match 1 huruf)
  function matchTag(query, tokens, tag) {
    const nt = norm(tag);
    if (nt.length <= 3) {
      // Jika tag pendek (misal: 'C', 'H', 'JS'), harus sama persis dengan token
      return tokens.includes(nt);
    }
    // Jika tag panjang, bisa substring atau fuzzy
    if (query.includes(nt)) return true;
    for (const word of tokens) {
      if (word === nt) return true;
      if (word.length > 3 && levenshtein(word, nt) <= 1) return true; // Toleransi 1 typo
    }
    return false;
  }

  /* =========================================================
     MATH ENGINE
     ========================================================= */
  function tryMath(q) {
    let t = norm(q);
    
    // Persentase
    const percentMatch = t.match(/(\d+)\s*%?\s*(dari|of)\s*(\d+)/i);
    if (percentMatch) return (parseFloat(percentMatch[1]) / 100) * parseFloat(percentMatch[3]);

    // Akar
    if (/akar\s+dari/i.test(t)) {
      const num = t.match(/\d+/);
      if (num) return Math.sqrt(parseFloat(num[0]));
    }
    
    // Simbol dasar
    t = t.replace(/berapa hasil dari|berapa hasil|berapa|hasil dari|hitung|kalkulator/g, '');
    const wordMap = {
      'tambah': '+', 'ditambah': '+', 'plus': '+',
      'kurang': '-', 'dikurangi': '-', 'minus': '-',
      'kali': '*', 'dikali': '*', 'times': '*',
      'bagi': '/', 'dibagi': '/', 'per': '/',
      'pangkat': '**', 'nol': '0', 'satu': '1', 'dua': '2', 'tiga': '3', 
      'empat': '4', 'lima': '5', 'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9', 'sepuluh': '10'
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
     INTENT DETECTION
     ========================================================= */
  function detectLanguage(q) {
    const t = norm(q);
    if (/\bhtml5?\b/.test(t)) return 'html';
    if (/\bjavascript\b|\bjs\b/.test(t)) return 'js';
    if (/\bcpp\b|\bc\+\+\b/.test(t)) return 'cpp';
    if (/\bxml\b/.test(t)) return 'xml';
    return null;
  }

  function detectSocial(q) {
    const t = norm(q);
    if (/^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum)\b/.test(t)) return 'greeting';
    if (/^(makasih|terima\s*kasih|thanks|thx)\b/.test(t)) return 'thanks';
    if (/kamu\s+siapa|siapa\s+(kamu|anda|kau)|namamu/i.test(t)) return 'identity';
    
    // Percakapan Santai (Filler)
    if (/^(stop|berhenti|udah|yaudah|gajadi|gak jadi|oke|ok|sip|mantap|hmm|apa|hah|oh)$/i.test(t)) return 'filler';
    
    // Deteksi tanya kemampuan koding
    if (/bisa\s+(ngoding|koding|buat\s+kode|code|program)/i.test(t)) return 'code_prompt';
    
    // Bantuan
    if (/bisa\s+apa|kemampuan|fitur|help|bantuan|bisa\s+bantu/i.test(t)) return 'help';
    return null;
  }

  /* =========================================================
     THINKING & SEARCH
     ========================================================= */
  function think(query) {
    const raw = String(query || '').trim();
    const t = norm(raw);
    const tokens = toks(raw);
    const social = detectSocial(raw);
    const lang = detectLanguage(raw);
    const math = tryMath(raw);

    const lastAi = state.MEMORY.length ? [...state.MEMORY].reverse().find(m => m.role === 'ai') : null;

    let intent = 'knowledge';
    if (social) intent = 'social';
    else if (math !== null) intent = 'math';
    else if (lang) intent = 'code';

    return {
      raw, normalized: t, tokens, intent, social, language: lang, math,
      context: { lastCategory: lastAi ? lastAi.kategori : null },
      steps: [
        'Menganalisis teks...',
        'Intent: ' + intent.toUpperCase(),
        'Mengecek memori & konteks...',
        'Menyiapkan jawaban...'
      ]
    };
  }

  function search(thought) {
    const q = thought.normalized;
    const tokens = thought.tokens;
    const candidates = [];

    for (const entry of state.KB) {
      let score = 0;
      let matchedTags = 0;

      for (const p of entry.patterns) {
        try { if (p.test(q)) score += 200; } catch (e) {}
      }

      for (const tag of entry.tags) {
        if (matchTag(q, tokens, tag)) {
          score += 50;
          matchedTags++;
        }
      }

      if (entry.kategori && thought.context.lastCategory === entry.kategori) score += 15;

      if (score > 0) candidates.push({ entry, score, matchedTags });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    let confidence = best ? Math.min(1, best.score / 100) : 0;
    
    return { best, all: candidates.slice(0, 3), confidence };
  }

  /* =========================================================
     SYNTHESIS (RESPONSE GENERATOR)
     ========================================================= */
  function synthesize(thought, searchResult) {
    if (thought.intent === 'math') {
      return { answer: `Hasilnya adalah **${thought.math}**.`, intent: 'math', sources: [], confidence: 0.99 };
    }

    if (thought.intent === 'code' && thought.language) {
      return generateCode(thought.language, thought.raw);
    }

    if (thought.intent === 'social') {
      const s = thought.social;
      let ans = '';
      if (s === 'greeting') ans = `Halo! Saya **Deepz AI v${AI_CONFIG.version}**. Ada yang bisa saya bantu hari ini?`;
      else if (s === 'thanks') ans = `Sama-sama! Senang bisa membantu.`;
      else if (s === 'identity') ans = `Saya **Deepz AI v${AI_CONFIG.version} (World Master)**. AI otonom tanpa API yang siap membantu dengan pengetahuan dunia dan koding.`;
      else if (s === 'filler') ans = `Oke, siap! Kalau ada yang mau ditanyakan lagi, ketik saja.`;
      else if (s === 'code_prompt') ans = `Tentu! Saya sangat bisa membuatkan kode untukmu. Saya menguasai **HTML, JavaScript, C++, dan XML**. Silakan sebutkan apa yang ingin dibuat, misal: "Buatkan HTML form login" atau "Buatkan JS loop".`;
      else if (s === 'help') ans = `Tentu! Saya bisa bantu dengan:\n1. **Pengetahuan Umum** (Geografi, Sains, Sejarah, Kimia, Astronomi).\n2. **Matematika** (misal: "20% dari 500").\n3. **Koding** (HTML/JS/CPP/XML).\n4. **Percakapan Santai**.\n\nApa yang ingin kamu cari?`;
      
      return { answer: ans, intent: 'social', sources: [], confidence: 0.95 };
    }

    if (searchResult.best && searchResult.best.score >= 40) {
      const entry = searchResult.best.entry;
      let ans = typeof entry.jawaban === 'function' ? entry.jawaban(thought.raw) : entry.jawaban;
      return {
        answer: ans, intent: 'knowledge',
        sources: searchResult.all.map(c => ({ id: c.entry.id, kategori: c.entry.kategori })),
        confidence: searchResult.confidence
      };
    }

    return { 
      answer: `Saya belum menemukan data spesifik untuk **"${thought.raw}"**. Coba tanyakan hal lain seperti "ibu kota jepang", "unsur emas", atau "buatkan HTML".`, 
      intent: 'fallback', sources: [], confidence: 0.1 
    };
  }

  /* =========================================================
     CODE GENERATOR
     ========================================================= */
  function generateCode(lang, query) {
    const q = norm(query);
    const templates = state.CODE[lang] || [];
    let best = null, bestScore = 0;
    
    for (const tpl of templates) {
      let s = 0;
      for (const k of (tpl.keys || [])) { if (q.includes(norm(k))) s += 12; }
      if (s > bestScore) { bestScore = s; best = tpl; }
    }
    if (!best) best = templates.find(t => t.default) || templates[0];

    const code = typeof best.build === 'function' ? best.build(query) : String(best.build);
    return {
      answer: `Tentu, ini kode **${lang.toUpperCase()}** untukmu:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nAda bagian yang ingin diubah?`,
      intent: 'code', sources: [{ id: 'code.' + lang, kategori: 'Koding' }], confidence: 0.95
    };
  }

  /* =========================================================
     MAIN PIPELINE
     ========================================================= */
  async function ask(query) {
    state.STATS.queries++;
    const thought = think(query);
    const searchResult = search(thought);
    const draft = synthesize(thought, searchResult);
    
    state.MEMORY.push({ role: 'user', text: query });
    state.MEMORY.push({ role: 'ai', text: draft.answer, kategori: draft.intent });
    if (state.MEMORY.length > 10) state.MEMORY.splice(0, 2);

    return {
      query, answer: draft.answer, intent: draft.intent, confidence: draft.confidence,
      sources: draft.sources, 
      thinking: [
        { stage: 'thinking', detail: thought.steps.join(' | ') },
        { stage: 'search', detail: `Memindai ${state.KB.length} node. Ditemukan ${searchResult.all.length} kandidat.` },
        { stage: 'synthesis', detail: 'Merangkai jawaban akhir' },
        { stage: 'verify', detail: 'Selesai' }
      ],
      elapsed: 100, version: AI_CONFIG.version
    };
  }

  /* =========================================================
     KNOWLEDGE BASE BUILDER
     ========================================================= */
  function learnKnowledge(arr) {
    for (const e of arr) {
      if (!e.id || state.KB.some(x => x.id === e.id)) continue;
      state.KB.push({ id: e.id, kategori: e.kategori || 'umum', tags: e.tags || [], patterns: e.patterns || [], jawaban: e.jawaban });
    }
  }

  function learnCode(lang, templates) {
    const key = norm(lang);
    state.CODE[key] = state.CODE[key] || [];
    state.CODE[key].push(...templates);
  }

  function buildDataset() {
    // 1. NEGARA
    const countries = [
      ['Indonesia', 'Jakarta', 'Rupiah'], ['Malaysia', 'Kuala Lumpur', 'Ringgit'],
      ['Singapura', 'Singapura', 'Dolar Singapura'], ['Thailand', 'Bangkok', 'Baht'],
      ['Filipina', 'Manila', 'Peso'], ['Vietnam', 'Hanoi', 'Dong'],
      ['Jepang', 'Tokyo', 'Yen'], ['Korea Selatan', 'Seoul', 'Won'],
      ['Tiongkok', 'Beijing', 'Yuan'], ['India', 'New Delhi', 'Rupee'],
      ['Amerika Serikat', 'Washington DC', 'Dolar AS'], ['Kanada', 'Ottawa', 'Dolar Kanada'],
      ['Brasil', 'Brasilia', 'Real'], ['Inggris', 'London', 'Pound'],
      ['Prancis', 'Paris', 'Euro'], ['Jerman', 'Berlin', 'Euro'],
      ['Rusia', 'Moskow', 'Rubel'], ['Australia', 'Canberra', 'Dolar Australia'],
      ['Mesir', 'Kairo', 'Pound Mesir'], ['Arab Saudi', 'Riyadh', 'Riyal']
    ];
    countries.forEach(([negara, ibukota, uang]) => {
      learnKnowledge([{
        id: 'geo.' + negara, kategori: 'geografi',
        tags: [negara, 'ibu kota ' + negara, 'mata uang ' + negara],
        patterns: [new RegExp('ibu\\s*kota\\s*' + negara, 'i')],
        jawaban: `Ibu kota **${negara}** adalah **${ibukota}**, dengan mata uang **${uang}**.`
      }]);
    });

    // 2. KIMIA (Hati-hati dengan Tag Pendek)
    const elements = [
      ['H', 'Hidrogen', 1], ['He', 'Helium', 2], ['C', 'Karbon', 6], ['N', 'Nitrogen', 7],
      ['O', 'Oksigen', 8], ['Na', 'Natrium', 11], ['Fe', 'Besi', 26], ['Cu', 'Tembaga', 29],
      ['Ag', 'Perak', 47], ['Au', 'Emas', 79]
    ];
    elements.forEach(([simbol, nama, nomor]) => {
      learnKnowledge([{
        id: 'kimia.' + simbol, kategori: 'sains',
        // Gunakan tag spesifik agar tidak salah cocok dengan kata lain
        tags: ['unsur ' + nama, 'nama unsur ' + nama, 'nomor atom ' + nama], 
        patterns: [new RegExp('^' + nama + '$', 'i'), new RegExp('unsur\\s*' + nama, 'i')],
        jawaban: `Unsur **${nama} (${simbol})** memiliki nomor atom **${nomor}**.`
      }]);
    });

    // 3. PLANET
    const planets = [
      ['Merkurius', 'Planet terkecil dan terdekat dari Matahari.'],
      ['Venus', 'Planet terpanas karena efek rumah kaca.'],
      ['Bumi', 'Satu-satunya planet yang memiliki kehidupan.'],
      ['Mars', 'Dijuluki Planet Merah.'],
      ['Jupiter', 'Planet terbesar di Tata Surya.'],
      ['Saturnus', 'Terkenal dengan cincinnya.'],
      ['Uranus', 'Planet es yang berputar miring.'],
      ['Neptunus', 'Planet terjauh dengan angin tercepat.']
    ];
    planets.forEach(([nama, fakta]) => {
      learnKnowledge([{
        id: 'astro.' + nama, kategori: 'astronomi',
        tags: [nama, 'planet ' + nama],
        patterns: [new RegExp('planet\\s*' + nama, 'i')],
        jawaban: `**${nama}**: ${fakta}`
      }]);
    });

    // 4. SEJARAH & UMUM
    learnKnowledge([
      { id: 'hist.proklamasi', kategori: 'sejarah', tags: ['proklamasi', '17 agustus 1945'], jawaban: 'Proklamasi Kemerdekaan Indonesia dibacakan pada **17 Agustus 1945** oleh Soekarno dan Hatta.' },
      { id: 'umum.waktu', kategori: 'waktu', tags: ['jam berapa', 'tanggal berapa', 'sekarang'], patterns: [/jam\s+berapa|tanggal\s+berapa|hari\s+apa/i], jawaban: () => `Sekarang: **${new Date().toLocaleString('id-ID')}**.` }
    ]);

    // 5. KODING (World Coding)
    learnCode('html', [
      { keys: ['login', 'form'], default: true, build: () => `<!DOCTYPE html>\n<html>\n<head><title>Login</title></head>\n<body>\n  <form>\n    <input type="text" placeholder="User">\n    <input type="password" placeholder="Pass">\n    <button>Masuk</button>\n  </form>\n</body>\n</html>` }
    ]);
    learnCode('js', [
      { keys: ['loop', 'for'], default: true, build: () => `for(let i=1; i<=5; i++) {\n  console.log("Hitungan: " + i);\n}` }
    ]);
    learnCode('cpp', [
      { keys: ['hello', 'dasar'], default: true, build: () => `#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello World";\n  return 0;\n}` }
    ]);
    learnCode('xml', [
      { keys: ['config', 'data'], default: true, build: () => `<?xml version="1.0"?>\n<config>\n  <app>Deepz AI</app>\n</config>` }
    ]);
  }

  buildDataset();

  /* =========================================================
     EXPORT
     ========================================================= */
  global.DeepzAI = {
    version: AI_CONFIG.version, ask: ask,
    stats: () => ({ version: AI_CONFIG.version, entries: state.KB.length })
  };

  console.log(`%cDeepz AI v${AI_CONFIG.version} siap!%c\nTotal Entri: ${state.KB.length}\nMode: World Master`, 'color:#8b5cf6;font-weight:bold;font-size:14px', 'color:#666');

})(typeof window !== 'undefined' ? window : globalThis);
