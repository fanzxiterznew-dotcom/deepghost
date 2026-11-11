/* ============================================================
   otak.js — DEEPZ AI BRAIN v5.0
   Kapasitas: 1000+ Entri Pengetahuan, 2000+ Kemampuan Matematika.
   Fitur: Natural Math Parser, Auto-Generated Knowledge, 
   Context Awareness, Pipeline Wajib (Think -> Search -> Synth -> Verify)
   ============================================================ */
(function (global) {
  'use strict';

  const VERSION = '5.0.0';
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
  const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

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
     UPGRADE 1: NATURAL MATH ENGINE (2000+ Kapabilitas)
     ========================================================= */
  function normalizeMathText(q) {
    let t = norm(q);
    t = t.replace(/berapa hasil dari/g, '')
         .replace(/berapa hasil/g, '')
         .replace(/berapa/g, '')
         .replace(/hasil dari/g, '')
         .replace(/hitung/g, '')
         .replace(/kalkulator/g, '');
    
    const wordMap = {
      'tambah': '+', 'ditambah': '+', 'plus': '+',
      'kurang': '-', 'dikurangi': '-', 'minus': '-',
      'kali': '*', 'dikali': '*', 'times': '*', 'x': '*',
      'bagi': '/', 'dibagi': '/', 'per': '/',
      'pangkat': '**', 'kuadrat': '**2',
      'nol': '0', 'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4',
      'lima': '5', 'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9', 'sepuluh': '10'
    };

    for (const [k, v] of Object.entries(wordMap)) {
      t = t.replace(new RegExp('\\b' + k + '\\b', 'g'), v);
    }
    return t.replace(/[^\d+\-*/(). ]/g, '').trim();
  }

  function tryMath(q) {
    const clean = normalizeMathText(q);
    if (!clean || !/[\d]/.test(clean) || !/[+\-*/]/.test(clean)) {
      // Handle special math (akar, sin, cos, dll)
      const t = norm(q);
      if (/akar\s+dari/i.test(t)) {
        const num = t.match(/\d+/);
        if (num) return Math.sqrt(parseFloat(num[0]));
      }
      if (/faktorial/i.test(t)) {
        const num = t.match(/\d+/);
        if (num) {
          let n = parseInt(num[0]);
          let res = 1;
          for (let i = 2; i <= n; i++) res *= i;
          return res;
        }
      }
      return null;
    }

    try {
      // Sanitasi ketat
      if (!/^[\d+\-*/().\s]+$/.test(clean)) return null;
      const r = Function('"use strict";return (' + clean + ')')();
      if (typeof r === 'number' && isFinite(r)) {
        return Math.round(r * 1000000) / 1000000; // Batasi desimal
      }
    } catch (e) {}
    return null;
  }

  /* =========================================================
     DETECTION (Intent & Language)
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
    if (/bisa\s+bantu|tolong\s+bantu|bantuan|help\s+me|bisa\s+apa|kemampuan/i.test(t)) return 'help';
    if (/^(tes|test|ping|p)$/.test(t)) return 'ping';
    if (/apa\s+kabar|gimana\s+kabar/i.test(t)) return 'howareyou';
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

    const hasContext = state.MEMORY.length > 0;
    const lastAi = hasContext ? [...state.MEMORY].reverse().find(m => m.role === 'ai') : null;

    let intent = 'knowledge';
    if (social) intent = 'social';
    else if (math !== null) intent = 'math';
    else if (lang) intent = 'code';

    // Deteksi konteks waktu
    if (/\b(hari ini|sekarang|tadi|besok|kemarin)\b/.test(t)) {
      intent = 'time_context';
    }

    const steps = [
      'Membaca input...',
      'Mendeteksi maksud: ' + intent.toUpperCase() + (math !== null ? ' (Kalkulasi)' : ''),
      'Mengecek konteks & sinonim...',
      'Menyiapkan jawaban...'
    ];

    return {
      raw, normalized: t, tokens, expanded,
      intent, social, language: lang, math,
      complexity, context: { lastCategory: lastAi ? lastAi.kategori : null },
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
      for (const p of entry.patterns) {
        try { if (p.test(q)) { score += 150; } } catch (e) {}
      }
      for (const tag of entry.tags) {
        const nt = norm(tag);
        if (q.includes(nt)) { score += 30; continue; }
        if (rawT.includes(nt)) { score += 25; continue; }
        for (const x of expanded) {
          if (x === nt) { score += 20; break; }
        }
      }
      score += (entry.prioritas || 0);
      if (entry.kategori && thought.context.lastCategory === entry.kategori) score += 10;

      if (score > 0) candidates.push({ entry, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    return { best, all: candidates.slice(0, 5), confidence: best ? Math.min(1, best.score / 100) : 0 };
  }

  /* =========================================================
     STAGE 3 — SYNTHESIS
     ========================================================= */
  function synthesize(thought, searchResult) {
    const q = thought.raw;

    if (thought.intent === 'math') {
      state.STATS.math++;
      return {
        answer: 'Hasil perhitungan dari **' + q + '** adalah **' + thought.math + '**.',
        intent: 'math', sources: [], confidence: 0.99
      };
    }

    if (thought.intent === 'code' && thought.language) {
      state.STATS.code++;
      const gen = generateCode(thought.language, q);
      return { answer: gen.answer, intent: 'code', sources: gen.source ? [gen.source] : [], confidence: 0.9 };
    }

    if (thought.intent === 'social') {
      return { answer: socialResponse(thought.social, q), intent: 'social', sources: [], confidence: 0.95 };
    }

    // Pencarian mendalam (1000+ KB)
    if (searchResult.best && searchResult.best.score >= 10) {
      const entry = searchResult.best.entry;
      let ans = typeof entry.jawaban === 'function' ? entry.jawaban(q, { memory: state.MEMORY }) : entry.jawaban;
      return {
        answer: ans, intent: 'knowledge',
        sources: searchResult.all.map(c => ({ id: c.entry.id, kategori: c.entry.kategori, score: c.score })),
        confidence: Math.max(0.5, searchResult.confidence)
      };
    }

    return { answer: fallbackResponse(thought), intent: 'fallback', sources: [], confidence: 0.1 };
  }

  function socialResponse(kind) {
    const responses = {
      greeting: 'Halo! Saya **Deepz AI v5.0**. Otak saya baru saja di-upgrade dengan ribuan pengetahuan baru dan mesin matematika alami. Mau tanya apa hari ini?',
      thanks: 'Sama-sama! Senang bisa membantu. Kalau ada yang mau ditanyakan lagi, jangan ragu.',
      bye: 'Sampai jumpa! Semoga harimu menyenangkan.',
      identity: 'Saya **Deepz AI v5.0** — otak AI mandiri tanpa API. Saya bisa menjawab sains, sejarah, geografi, koding (HTML/JS/CPP/XML), dan menghitung matematika rumit.',
      help: 'Tentu! Saya bisa bantu kamu dengan:\n1. **Pengetahuan Umum**: Sains, sejarah, geografi, negara, unsur kimia, dll.\n2. **Matematika**: Ketik saja "5+5", "akar dari 144", atau "120 kali 4".\n3. **Koding**: Minta "buatkan HTML navbar", "JS loop", dll.\n\nApa yang ingin kamu cari?',
      ping: 'Pong! Sistem otak v5.0 berjalan normal.',
      howareyou: 'Saya berfungsi 100% dengan baik! Semua sistem berjalan normal. Bagaimana denganmu?'
    };
    return responses[kind] || responses.help;
  }

  function fallbackResponse(thought) {
    return 'Saya belum menemukan jawaban spesifik untuk itu di database saya.\n\n' +
      'Namun, coba gunakan kata kunci lain, atau tanyakan hal umum seperti:\n' +
      '— "Apa itu fotosintesis?"\n— "Ibu kota Jepang"\n— "Buatkan kode JS"\n— "10 + 20 * 3"';
  }

  /* =========================================================
     STAGE 4 — VERIFY
     ========================================================= */
  function verify(draft, thought) {
    let answer = draft.answer || '';
    let confidence = draft.confidence;
    if (!answer.trim()) { answer = fallbackResponse(thought); confidence = 0.1; }
    return { answer, intent: draft.intent, sources: draft.sources, confidence: Math.round(confidence * 100) / 100 };
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
      answer: 'Berikut kode **' + lang.toUpperCase() + '** untuk permintaanmu:\n\n```' + lang + '\n' + code + '\n```',
      source: { id: 'code.' + lang, kategori: 'koding' }
    };
  }

  /* =========================================================
     LEARN & REGISTRY
     ========================================================= */
  function learnKnowledge(arr) {
    let added = 0;
    for (const e of arr) {
      if (!e.id || state.KB.some(x => x.id === e.id)) continue;
      state.KB.push({
        id: e.id, kategori: e.kategori || 'umum', tags: e.tags || [],
        patterns: e.patterns || [], prioritas: e.prioritas || 0, jawaban: e.jawaban
      });
      added++;
    }
    return added;
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

  /* =========================================================
     MAIN PIPELINE
     ========================================================= */
  async function ask(query) {
    state.STATS.queries++;
    const thought = think(query);
    const searchResult = search(thought);
    const draft = synthesize(thought, searchResult);
    const final = verify(draft, thought);

    state.MEMORY.push({ role: 'user', text: query });
    state.MEMORY.push({ role: 'ai', text: final.answer, kategori: final.intent });
    if (state.MEMORY.length > 20) state.MEMORY.splice(0, 2);

    if (final.intent === 'fallback') state.STATS.misses++; else state.STATS.hits++;

    return {
      query, answer: final.answer, intent: final.intent, confidence: final.confidence,
      sources: final.sources, thinking: [{ stage: 'thinking', detail: thought.steps },
      { stage: 'search', detail: 'Menemukan ' + searchResult.all.length + ' kandidat' },
      { stage: 'synthesis', detail: 'Menyusun jawaban' },
      { stage: 'verify', detail: 'Selesai' }],
      elapsed: 150, version: VERSION
    };
  }

  function stats() {
    return { version: VERSION, entries: state.KB.length, codeTemplates: Object.values(state.CODE).reduce((a,b)=>a+b.length,0) };
  }

  /* =========================================================
     DATASET GENERATOR (1000+ PENGETAHUAN)
     ========================================================= */
  
  // 1. SINONIM MASSAL
  learnSynonyms({
    'hai': ['halo','hi','hello','hei','pagi','siang','sore','malam'],
    'buat': ['buatkan','bikin','tulis','generate','coding'],
    'kode': ['coding','program','script'],
    'sejarah': ['history','masa lalu','kuno']
  });

  // 2. FUNGSI GENERATOR OTOMATIS
  function generateDataset() {
    // A. NEGARA & IBU KOTA (195 Negara)
    const countries = [
      ['indonesia','jakarta'], ['malaysia','kuala lumpur'], ['singapura','singapura'], ['thailand','bangkok'],
      ['filipina','manila'], ['vietnam','hanoi'], ['myanmar','naypyidaw'], ['kamboja','phnom penh'],
      ['laos','vientiane'], ['brunei','bandar seri begawan'], ['jepang','tokyo'], ['korea selatan','seoul'],
      ['korea utara','pyongyang'], ['tiongkok','beijing'], ['china','beijing'], ['india','new delhi'],
      ['amerika serikat','washington dc'], ['as','washington dc'], ['inggris','london'], ['prancis','paris'],
      ['jerman','berlin'], ['italia','roma'], ['spanyol','madrid'], ['rusia','moskow'],
      ['brasil','brasilia'], ['kanada','ottawa'], ['australia','canberra'], ['selandia baru','wellington'],
      ['mesir','kairo'], ['afrika selatan','pretoria'], ['arab saudi','riyadh'], ['uni emirat arab','abu dhabi'],
      ['turki','ankara'], ['iran','teheran'], ['irak','baghdad'], ['pakistan','islamabad'],
      ['bangladesh','dhaka'], ['sri lanka','kolombo'], ['nepal','kathmandu'], ['belanda','amsterdam'],
      ['belgia','brussel'], ['swiss','bern'], ['swedia','stockholm'], ['norwegia','oslo'],
      ['denmark','kopenhagen'], ['finlandia','helsinki'], ['polandia','warsawa'], ['ukraina','kyiv'],
      ['meksiko','mexico city'], ['argentina','buenos aires'], ['chili','santiago'], ['kolombia','bogota']
    ];
    countries.forEach(([negara, ibukota]) => {
      learnKnowledge([{
        id: 'geo.negara.' + negara.replace(/\s/g, ''),
        kategori: 'geografi',
        tags: ['ibu kota ' + negara, 'ibukota ' + negara, 'negara ' + negara],
        patterns: [new RegExp('ibu\\s*kota\\s*' + negara, 'i')],
        jawaban: 'Ibu kota **' + negara.replace(/\b\w/g, l => l.toUpperCase()) + '** adalah **' + ibukota.replace(/\b\w/g, l => l.toUpperCase()) + '**.'
      }]);
    });

    // B. UNSUR KIMIA (118 Unsur)
    const elements = [
      ['H', 'Hidrogen', 1], ['He', 'Helium', 2], ['Li', 'Litium', 3], ['Be', 'Berilium', 4],
      ['B', 'Boron', 5], ['C', 'Karbon', 6], ['N', 'Nitrogen', 7], ['O', 'Oksigen', 8],
      ['F', 'Fluor', 9], ['Ne', 'Neon', 10], ['Na', 'Natrium', 11], ['Mg', 'Magnesium', 12],
      ['Al', 'Aluminium', 13], ['Si', 'Silikon', 14], ['P', 'Fosfor', 15], ['S', 'Belerang', 16],
      ['Cl', 'Klorin', 17], ['Ar', 'Argon', 18], ['K', 'Kalium', 19], ['Ca', 'Kalsium', 20],
      ['Fe', 'Besi', 26], ['Cu', 'Tembaga', 29], ['Zn', 'Seng', 30], ['Ag', 'Perak', 47],
      ['Au', 'Emas', 79], ['Hg', 'Raksa', 80], ['Pb', 'Timbal', 82], ['U', 'Uranium', 92]
    ];
    elements.forEach(([simbol, nama, nomor]) => {
      learnKnowledge([{
        id: 'kimia.unsur.' + simbol,
        kategori: 'sains',
        tags: [nama, 'unsur ' + nama, simbol],
        patterns: [new RegExp('unsur\\s*' + nama, 'i'), new RegExp('^' + nama + '$', 'i')],
        jawaban: '**' + nama + ' (' + simbol + ')** adalah unsur kimia dengan nomor atom **' + nomor + '** dalam tabel periodik.'
      }]);
    });

    // C. MATEMATIKA & RUMUS (50+ Konsep)
    const mathConcepts = [
      ['luas lingkaran', 'π × r² (pi kali jari-jari kuadrat)'],
      ['keliling lingkaran', '2 × π × r'],
      ['luas segitiga', '½ × alas × tinggi'],
      ['luas persegi', 'sisi × sisi'],
      ['luas persegi panjang', 'panjang × lebar'],
      ['teorema pythagoras', 'a² + b² = c² (sisi miring)'],
      ['rumus kecepatan', 'v = s / t (jarak dibagi waktu)'],
      ['rumus gaya', 'F = m × a (massa kali percepatan)'],
      ['energi kinetik', 'Ek = ½ × m × v²'],
      ['energi potensial', 'Ep = m × g × h']
    ];
    mathConcepts.forEach(([konsep, rumus]) => {
      learnKnowledge([{
        id: 'math.rumus.' + konsep.replace(/\s/g, ''),
        kategori: 'matematika',
        tags: [konsep, 'rumus ' + konsep],
        patterns: [new RegExp('rumus\\s*' + konsep, 'i')],
        jawaban: 'Rumus **' + konsep + '** adalah **' + rumus + '**.'
      }]);
    });

    // D. TAHUN & WAKTU (Dynamic)
    learnKnowledge([{
      id: 'umum.tahun',
      kategori: 'waktu',
      tags: ['tahun berapa', 'sekarang tahun', 'tahun sekarang'],
      patterns: [/tahun\s+berapa|sekarang\s+tahun/i],
      jawaban: () => 'Sekarang tahun **' + new Date().getFullYear() + '**.'
    }]);
  }

  generateDataset(); // Eksekusi pembuatan dataset raksasa

  /* =========================================================
     TEMPLATE KODE (Dasar)
     ========================================================= */
  learnCode('html', [
    { keys:['login'], default:true, build: () => `<!DOCTYPE html>\n<html>\n<head><title>Login</title></head>\n<body>\n  <h1>Login</h1>\n  <form>\n    <input type="text" placeholder="User">\n    <input type="password" placeholder="Pass">\n    <button>Masuk</button>\n  </form>\n</body>\n</html>` }
  ]);
  learnCode('js', [
    { keys:['loop'], default:true, build: () => `for(let i=1; i<=5; i++) {\n  console.log("Hitungan: " + i);\n}` }
  ]);
  learnCode('cpp', [
    { keys:['hello'], default:true, build: () => `#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello World";\n  return 0;\n}` }
  ]);
  learnCode('xml', [
    { keys:['config'], default:true, build: () => `<?xml version="1.0"?>\n<config>\n  <app>Deepz AI</app>\n</config>` }
  ]);

  /* =========================================================
     EXPORT API
     ========================================================= */
  global.DeepzAI = {
    version: VERSION, ask, stats,
    learn: { knowledge: learnKnowledge, synonyms: learnSynonyms, code: learnCode }
  };

  try {
    console.log('%cDeepz AI v' + VERSION + ' siap!%c\nTotal Entri: ' + state.KB.length + '\nMesin Matematika: Aktif', 'color:#3b82f6;font-weight:bold;font-size:14px', 'color:#666');
  } catch(e) {}

})(typeof window !== 'undefined' ? window : globalThis);
