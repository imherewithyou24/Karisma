// ==========================================
// 1. SYSTEM LISTENER DATABASE CLOUD REALTIME
// ==========================================
window.db.ref().on('value', (snapshot) => {
    window.globalData = snapshot.val() || {};
    updateUISecaraRealtime();
});

function updateUISecaraRealtime() {
    try {
        // 1. SMART DETECTION: Update teks (ANTI DOM THRASHING KHUSUS IPHONE)
        document.querySelectorAll('.editable-text').forEach(el => {
            if(el.id && window.globalData) {
                let data = window.globalData[el.id];
                if(data && typeof data === 'string' && data.trim() !== '') {
                    if(el.innerText !== data) { el.innerText = data; }
                }
                
                let fontData = window.globalData['font_' + el.id];
                if(fontData && typeof fontData === 'string' && fontData.trim() !== '') {
                    if(el.style.fontFamily !== fontData) el.style.fontFamily = fontData;
                } else {
                    if(el.style.fontFamily !== "") el.style.fontFamily = ""; 
                }
            }
        });

        // 2. FIX BUG IPHONE: Render Gambar dengan Smart Caching
        const imgIds = ['heroBg', 'logo1', 'logo2', 'logo3'];
        imgIds.forEach(id => {
            let imgSrc = window.globalData[id];
            if(imgSrc && typeof imgSrc === 'string' && imgSrc.length > 5) {
                if(id === 'heroBg') {
                    let heroEl = document.getElementById('heroSection');
                    if(heroEl && !heroEl.style.backgroundImage.includes(imgSrc)) {
                        heroEl.style.backgroundImage = `url('${imgSrc}')`;
                        heroEl.style.backgroundSize = 'cover';
                        heroEl.style.backgroundPosition = 'center';
                        heroEl.style.backgroundRepeat = 'no-repeat';
                    }
                } else {
                    let imgEl = document.getElementById(id);
                    if(imgEl && imgEl.src !== imgSrc) { imgEl.src = imgSrc; }
                }
            }
        });

        // 3. Sinkronisasi warna
        if(window.globalData.karisma_theme && typeof window.globalData.karisma_theme === 'string') {
            document.documentElement.style.setProperty('--dark-blue', window.globalData.karisma_theme);
        }
        
        // 4. Render Modul Lain
        if(typeof renderTracker === 'function') renderTracker();
        if(typeof renderAgenda === 'function') renderAgenda();
        if(typeof renderRepositori === 'function') renderRepositori();
        if(typeof cariBerita === 'function' && document.getElementById('searchInput')) cariBerita(); 
        
        // Render Komentar Jika Sedang di Halaman Baca
        if(window.activeNewsId && typeof renderKomentar === 'function') renderKomentar(window.activeNewsId); 
        
        // 5. Gamifikasi
        if(typeof renderPollingRealtime === 'function') renderPollingRealtime();
        if(typeof renderDailyChallenge === 'function') renderDailyChallenge();
        if(typeof renderLeaderboard === 'function') renderLeaderboard();
        
        // 6. Update stat
        let inboxD = window.globalData.karisma_inbox || [];
        if(document.getElementById('statInbox')) document.getElementById('statInbox').innerText = inboxD.length;
        if(window.globalData.karisma_visitors && document.getElementById('statVisitor')) {
            document.getElementById('statVisitor').innerText = window.globalData.karisma_visitors.toLocaleString();
        }
        
    } catch (error) {
        console.error("Sistem UI Terhenti karena Error Data:", error);
    }
}

// ==========================================
// 2. LOGIKA PENGUNJUNG MURNI
// ==========================================
if(!sessionStorage.getItem('visited')) {
    window.db.ref('karisma_visitors').once('value').then(snap => {
        let v = snap.val() || 0; 
        window.db.ref('karisma_visitors').set(v + 1);
        sessionStorage.setItem('visited', 'true');
    });
}

// ==========================================
// VAKSIN ANTI-CRASH FIREBASE & MESIN WAKTU SCHEDULED
// ==========================================
function getSafeNewsArray() {
    let raw = window.globalData.karisma_news;
    if (!raw) return [];
    let arr = Array.isArray(raw) ? raw : Object.values(raw);
    let aman = arr.filter(n => n !== null && n !== undefined && n.id !== undefined);
    
    // Logika Publikasi Otomatis (Mesin Waktu)
    let sekarang = new Date();
    
    if(window.role !== 'admin' && window.role !== 'mod') {
        return aman.filter(n => {
            if (!n.status || n.status === 'Publish') return true;
            
            // Jika Scheduled, cek apakah waktunya sudah lewat!
            if (n.status === 'Scheduled' && n.scheduled_date && n.scheduled_time) {
                let waktuJadwal = new Date(`${n.scheduled_date}T${n.scheduled_time}`);
                if (sekarang >= waktuJadwal) return true; // Tembus ke publik!
            }
            return false; // Sembunyikan jika masih Draft atau belum waktunya
        });
    }
    // Admin & Mod melihat semuanya
    return aman;
}

function getSafeRepoArray() {
    let raw = window.globalData.karisma_repo;
    if (!raw) return [];
    let arr = Array.isArray(raw) ? raw : Object.values(raw);
    
    // Beri ID sementara untuk data lama yang belum punya ID agar tombol edit/hapus tetap jalan
    arr.forEach((n, i) => { if(!n.id) n.id = 888000 + i; });
    
    let aman = arr.filter(n => n !== null && n !== undefined && n.id !== undefined);
    let sekarang = new Date();
    
    if(window.role !== 'admin' && window.role !== 'mod') {
        return aman.filter(n => {
            if (!n.status || n.status === 'Publish') return true;
            if (n.status === 'Scheduled' && n.scheduled_date && n.scheduled_time) {
                let waktuJadwal = new Date(`${n.scheduled_date}T${n.scheduled_time}`);
                if (sekarang >= waktuJadwal) return true;
            }
            return false;
        });
    }
    return aman;
}

// ==========================================
// 3. MESIN ROUTING URL, HALAMAN BACA & ARSIP
// ==========================================
window.addEventListener('popstate', checkURLRouting);
document.addEventListener('DOMContentLoaded', checkURLRouting);

function checkURLRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const idBerita = urlParams.get('berita');
    const isArsip = urlParams.get('arsip');
    const isArsipPdf = urlParams.get('arsippdf'); // TAHAP 3: Parameter URL Baru untuk PDF
    
    const mainSections = ['heroSection', 'profil', 'kawaljanji', 'agenda', 'berita', 'repositori', 'interaktif', 'angket'];
    
    if (idBerita) {
        mainSections.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        if(document.getElementById('arsipSection')) document.getElementById('arsipSection').style.display = 'none';
        if(document.getElementById('arsipPdfSection')) document.getElementById('arsipPdfSection').style.display = 'none';
        if(document.getElementById('readingSection')) document.getElementById('readingSection').style.display = 'block';
        window.scrollTo(0, 0);
        
        if (window.globalData && window.globalData.karisma_news) {
            renderHalamanBacaPenuh(parseInt(idBerita));
        } else {
            window.db.ref('karisma_news').once('value').then(snap => {
                if(!window.globalData) window.globalData = {};
                window.globalData.karisma_news = snap.val();
                renderHalamanBacaPenuh(parseInt(idBerita));
            });
        }
    } else if (isArsip) {
        mainSections.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        if(document.getElementById('readingSection')) document.getElementById('readingSection').style.display = 'none';
        if(document.getElementById('arsipPdfSection')) document.getElementById('arsipPdfSection').style.display = 'none';
        if(document.getElementById('arsipSection')) {
            document.getElementById('arsipSection').style.display = 'block';
            filterArsip('Semua'); 
        }
        window.scrollTo(0, 0);
    } else if (isArsipPdf) {
        // TAHAP 3: Mode Arsip PDF Penuh
        mainSections.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        if(document.getElementById('readingSection')) document.getElementById('readingSection').style.display = 'none';
        if(document.getElementById('arsipSection')) document.getElementById('arsipSection').style.display = 'none';
        if(document.getElementById('arsipPdfSection')) {
            document.getElementById('arsipPdfSection').style.display = 'block';
            filterArsipPdfLengkap(); 
        }
        window.scrollTo(0, 0);
    } else {
        // Mode Beranda
        mainSections.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'block'; });
        if(document.getElementById('heroSection')) document.getElementById('heroSection').style.display = 'flex'; 
        if(document.getElementById('readingSection')) document.getElementById('readingSection').style.display = 'none';
        if(document.getElementById('arsipSection')) document.getElementById('arsipSection').style.display = 'none';
        if(document.getElementById('arsipPdfSection')) document.getElementById('arsipPdfSection').style.display = 'none';
    }
}

function bukaBacaBerita(id) {
    window.history.pushState({}, '', '?berita=' + id);
    checkURLRouting();
}

function bukaArsipPenuh() {
    window.history.pushState({}, '', '?arsip=true');
    checkURLRouting();
}

// TAHAP 3: Fungsi Pemicu Halaman Arsip PDF
window.bukaArsipPdfPenuh = function() {
    window.history.pushState({}, '', '?arsippdf=true');
    checkURLRouting();
};

function kembaliKeBeranda() {
    window.history.pushState({}, '', window.location.pathname);
    checkURLRouting();
}

// ==========================================
// 1. TAMBAHKAN FUNGSI BARU INI (Untuk Tarik Filter Dinamis dari Firebase)
// ==========================================
function renderFilterArsip(dbNews) {
    let container = document.getElementById('dynamicArsipFilters');
    if(!container) return;
    
    // Ambil Kategori Unik dari Database Firebase menggunakan Set()
    let categoriesSet = new Set(dbNews.map(n => n.badge).filter(Boolean));
    let categories = ['Semua', ...Array.from(categoriesSet)];
    
    container.innerHTML = categories.map(cat => 
        `<button class="btn btn-sm btn-outline-dark rounded-pill fw-medium" onclick="filterArsip('${cat}', this)">${cat}</button>`
    ).join('');
}

// ==========================================
// 2. TIMPA FUNGSI LAMA INI (Tampilan Card menyesuaikan Carousel)
// ==========================================
function filterArsip(kategori, btnElement = null) {
    let dbNews = typeof getSafeNewsArray === 'function' ? getSafeNewsArray() : [];
    let container = document.getElementById('arsipContainer');
    if(!container) return;

    // Panggil render filter jika tombol filter belum ada
    if(!document.getElementById('dynamicArsipFilters').innerHTML.trim()) {
        renderFilterArsip(dbNews);
    }

    // Indikator UI Tombol Aktif
    if(btnElement) {
        document.querySelectorAll('#dynamicArsipFilters .btn').forEach(b => b.classList.remove('active', 'btn-dark'));
        btnElement.classList.add('active', 'btn-dark');
    } else {
        document.querySelectorAll('#dynamicArsipFilters .btn').forEach(b => {
            b.classList.remove('active', 'btn-dark');
            if(b.innerText === 'Semua') b.classList.add('active', 'btn-dark');
        });
    }

    // Proses Filter
    let filtered = kategori === 'Semua' ? dbNews : dbNews.filter(n => n.badge === kategori);

    if(filtered.length === 0) {
        container.innerHTML = `<div class="w-100 text-center py-5"><h5 class="text-muted">Tidak ada arsip untuk kategori ${kategori}</h5></div>`;
        return;
    }

    // Render HTML Card dengan proporsi spesifik untuk Carousel
    container.innerHTML = filtered.map(n => {
        let dateStr = n.date && n.date !== "Baru Saja" ? n.date : "Baru Saja";
        let ringkasan = n.short || (n.full ? n.full.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : 'Tidak ada ringkasan.');

        return `
        <div class="news-card-wrapper hover-card">
            <div class="card shadow-sm border-0 rounded-4 bg-white h-100 d-flex flex-column text-start" style="border: 1px solid rgba(0,0,0,0.05) !important;">
                <img src="${n.img}" class="card-img-top w-100" style="height: 200px; object-fit: cover; border-top-left-radius: 1rem; border-top-right-radius: 1rem;" onerror="this.src='https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=600'">
                <div class="card-body p-4 d-flex flex-column flex-grow-1">
                    <div class="mb-3">
                        <span class="badge-modern ${getBadgeClass(n.badge)}">${n.badge}</span>
                    </div>
                    <h5 class="judul-berita-card fw-bold text-dark-blue mb-2" style="font-size: 1.15rem; line-height:1.4;">${n.title}</h5>
                    <p class="card-text text-muted mb-4 small" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${ringkasan}</p>
                    
                    <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                        <div>
                            <span class="small fw-bold text-dark-blue d-block text-truncate" style="max-width: 150px;">${n.penulis || 'Kastrat'}</span>
                            <span class="small text-muted" style="font-size: 0.75rem;">${dateStr}</span>
                        </div>
                        <button class="btn btn-dark-blue btn-sm rounded-pill fw-bold shadow-sm px-4 py-2" onclick="bukaBacaBerita(${n.id})">Baca</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderHalamanBacaPenuh(id) {
    let dbNews = getSafeNewsArray(); 
    if(!dbNews || dbNews.length === 0) return;
    
    const n = dbNews.find(x => x.id === id); 
    if(!n) { kembaliKeBeranda(); return; }
    
    window.activeNewsId = id; 
    if(document.getElementById('readImg')) document.getElementById('readImg').src = n.img; 
    if(document.getElementById('readBadge')) {
        document.getElementById('readBadge').className = `badge ${n.color || 'bg-danger'} px-3 py-2`;
        document.getElementById('readBadge').innerText = n.badge || 'Kajian'; 
    }
    if(document.getElementById('readTitle')) document.getElementById('readTitle').innerText = n.title; 
    
    let dateStr = n.date && n.date !== "Baru Saja" ? n.date : "Baru Saja dipublikasikan";
    let wordCount = n.full ? n.full.replace(/<[^>]*>?/gm, '').split(' ').length : 0;
    let readTime = Math.max(1, Math.ceil(wordCount / 200));

    let penulis = n.penulis || "Ahmad Hafiz Arsya"; 
    let divisi = n.divisi || "Divisi Kastrat";

    if(document.getElementById('readDate')) {
        document.getElementById('readDate').innerHTML = `
            <span class="d-block text-dark-blue fw-bold mb-1" style="font-size: 1.1rem;">Penulis: ${penulis}</span>
            <span class="d-block text-muted small mb-3 fw-medium">Divisi: ${divisi}</span>
            <i class="fa-regular fa-calendar me-1"></i> ${dateStr} &nbsp;•&nbsp; 
            <i class="fa-solid fa-stopwatch me-1"></i> ${readTime} menit membaca
        `;
    }
    
    if(document.getElementById('readContent')) document.getElementById('readContent').innerHTML = n.full;
    renderKomentar(id); 
    
    let related = dbNews.filter(x => x.id !== id).slice(0, 3);
    if(document.getElementById('relatedNewsContainer')) {
        document.getElementById('relatedNewsContainer').innerHTML = related.map(r => `
            <div class="col-md-4">
                <a href="javascript:void(0)" onclick="bukaBacaBerita(${r.id})" class="related-news-card bg-white h-100 d-flex flex-column text-decoration-none">
                    <img src="${r.img}" class="img-berita-standar" style="height: 160px;">
                    <div class="p-3">
                        <span class="badge ${r.color || 'bg-secondary'} mb-2" style="font-size:0.7rem;">${r.badge}</span>
                        <h6 class="judul-berita-card fw-bold text-dark-blue mb-0 text-dark" style="font-size: 1rem;">${r.title}</h6>
                    </div>
                </a>
            </div>
        `).join('');
    }
}

// ==========================================
// 4. FITUR KAWAL ISU & PORTAL BERITA KAJIAN
// ==========================================
function renderBeritaList(dataArray) {
    let container = document.getElementById('dynamicNewsContainer'); 
    if(!container) return; container.innerHTML = '';

    let dbNews = getSafeNewsArray();
    let datalist = document.getElementById('searchSuggestions');
    if(datalist && dbNews.length > 0) {
        datalist.innerHTML = dbNews.map(n => `<option value="${n.title}">`).join('');
    }
    
    if(!dataArray || dataArray.length === 0) { 
        container.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="fa-regular fa-newspaper fa-3x text-muted mb-3 opacity-25"></i>
            <h5 class="text-dark-blue fw-bold">Belum ada Kajian</h5>
            <p class="text-muted">Gunakan mode dewa untuk mempublikasikan naskah pertama.</p>
        </div>`; 
        return; 
    }
    
    const admDisp = window.role === 'admin' || window.role === 'mod' ? 'flex' : 'none';
    
    dataArray.forEach(n => {
        let dateStr = n.date && n.date !== "Baru Saja" ? n.date : "Baru Saja dipublikasikan";
        let ringkasan = n.short || (n.full ? n.full.replace(/<[^>]*>?/gm, '').substring(0, 120) + '...' : 'Tidak ada ringkasan.');
        
        let wordCount = n.full ? n.full.replace(/<[^>]*>?/gm, '').split(' ').length : 0;
        let readTime = Math.max(1, Math.ceil(wordCount / 200));

        let penulis = n.penulis || "Divisi Kastrat";

        container.innerHTML += `
        <div class="col-12 news-card-wrapper">
            <div class="card shadow-sm border-0 hover-card rounded-4 bg-white overflow-hidden text-start mb-2" style="border: 1px solid rgba(0,0,0,0.05) !important;">
                <div class="row g-0 align-items-stretch">
                    <div class="col-md-5 col-lg-4">
                        <img src="${n.img}" class="img-berita-standar h-100" onerror="this.src='https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=600'">
                    </div>
                    <div class="col-md-7 col-lg-8">
                        <div class="card-body news-card-body p-4 p-lg-4 d-flex flex-column h-100 justify-content-center">
                            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                <span class="badge-modern ${getBadgeClass(n.badge)}">${n.badge}</span>
                            </div>
                            <h4 class="judul-berita-card fw-bold text-dark-blue mb-2">${n.title}</h4>
                            <p class="card-text text-muted mb-4" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.95rem;">${ringkasan}</p>
                            
                            <div class="d-flex align-items-center justify-content-between mt-auto pt-3 border-top">
                                <div>
                                    <span class="small fw-bold text-dark-blue d-block">Penulis: ${penulis}</span>
                                    <span class="small text-muted">${dateStr} • ${readTime} menit baca</span>
                                </div>
                                <div class="d-flex gap-2 align-items-center">
                                    <button class="btn btn-sm btn-outline-danger admin-only shadow-sm rounded-pill px-3" style="display:${admDisp} !important;" onclick="hapusBerita(${n.id})"><i class="fa-solid fa-trash"></i></button>
                                    <button class="btn btn-dark-blue btn-baca-selengkapnya rounded-pill fw-bold shadow-sm" onclick="bukaBacaBerita(${n.id})">Baca <i class="fa-solid fa-arrow-right ms-1 d-none d-md-inline"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    container.innerHTML += `
    <div class="col-12 text-center mt-5 pt-3">
        <button class="btn btn-outline-primary border-2 rounded-pill px-5 py-2 fw-bold text-dark-blue" onclick="bukaArsipPenuh()">Lihat Semua Arsip Kajian <i class="fa-solid fa-arrow-right-long ms-2"></i></button>
    </div>`;
}

function cariBerita() {
    let kw = document.getElementById('searchInput').value.toLowerCase(); 
    let dbNews = getSafeNewsArray();
    if(kw === '') { 
        const hr = new Date().getHours(); 
        let startIdx = (hr * 3) % Math.max(1, dbNews.length);
        renderBeritaList(dbNews.slice(startIdx, startIdx + 3)); 
    } else { 
        renderBeritaList(dbNews.filter(n => n.title.toLowerCase().includes(kw)).slice(0, 6)); 
    }
}

function renderKomentar(id) {
    const d = window.globalData['komentar_berita_' + id] || [];
    let html = d.length === 0 ? '<p class="text-muted small py-2">Belum ada diskusi publik. Tulis pandangan Anda di bawah!</p>' : d.map((k, i) => {
        let badge = k.role === 'admin' || k.role === 'mod' ? '<span class="badge bg-warning text-dark ms-2"><i class="fa-solid fa-star"></i> Admin Kastrat</span>' : '';
        let delBtn = window.role === 'mod' ? `<button class="btn btn-sm text-danger position-absolute top-0 end-0 m-2 border-0 bg-transparent" onclick="hapusKomenDewa(${id}, ${i})"><i class="fa-solid fa-xmark fa-lg"></i></button>` : '';
        return `<div class="comment-box position-relative"><h6 class="fw-bold mb-1">${k.nama} ${badge} <span class="text-muted small ms-2 fw-normal">${k.waktu}</span></h6><p class="mb-0 text-dark">${k.isi}</p>${delBtn}</div>`;
    }).join('');
    
    if(document.getElementById('commentList')) document.getElementById('commentList').innerHTML = html;
}

function tambahKomentar() {
    let isi = document.getElementById('isiKomentar') ? document.getElementById('isiKomentar').value : ''; 
    if(isi.trim() === '') return;
    let d = window.globalData['komentar_berita_' + window.activeNewsId] || [];
    d.push({ nama: document.getElementById('namaKomentator').value || 'Anonim', isi: isi, role: window.role, waktu: new Date().toLocaleDateString('id-ID') });
    window.db.ref('komentar_berita_' + window.activeNewsId).set(d);
    if(document.getElementById('isiKomentar')) document.getElementById('isiKomentar').value = '';
}

// ==========================================
// 5. RENDER TRACKER, AGENDA, & PDF REPOSITORY
// ==========================================
function renderTracker(){ 
    let dTrack = [{ t:"Penurunan UKT Kampus", s:"Proses", c:"status-proses", i:"fa-spinner fa-spin text-warning"}];
    let d = window.globalData.karisma_tracker || dTrack; 
    if(document.getElementById('trackerContainer')) {
        document.getElementById('trackerContainer').innerHTML = d.map((x, i) => `
            <div class="tracker-item ${x.c}">
                <b class="text-dark">${x.t}</b> 
                <span class="badge bg-light text-dark border float-end"><i class="fa-solid ${x.i}"></i> ${x.s}</span> 
                <div class="admin-only gap-2 mt-2" style="display:none;">
                    <button class="btn btn-sm btn-outline-success mt-1" onclick="ubahStatusTracker(${i}, 'Selesai')"><i class="fa-solid fa-check"></i> Selesai</button> 
                    <button class="btn btn-sm btn-outline-danger mt-1 ms-1" onclick="hapusTracker(${i})"><i class="fa-solid fa-trash"></i> Hapus</button>
                </div>
            </div>`).join(''); 
    }
    if(window.role === 'admin' || window.role === 'mod') {
        document.querySelectorAll('#kawaljanji .admin-only').forEach(el => el.style.setProperty('display', 'block', 'important'));
    }
}

function renderAgenda(){ 
    let dAgen = [{ d:"10 Mar", t:"Diskusi Publik RUU Penyiaran", ds:"Di Ruang Teater FKIK ULM"}];
    let d = window.globalData.karisma_agenda || dAgen; 
    if(document.getElementById('agendaContainer')) {
        document.getElementById('agendaContainer').innerHTML = d.map((x, i) => `
            <div class="timeline-item">
                <span class="badge bg-primary mb-1">${x.d}</span>
                <h5 class="fw-bold mb-1 text-dark">${x.t}</h5>
                <p class="text-muted mb-1">${x.ds}</p>
                <button class="btn btn-sm btn-danger admin-only mt-1" style="display:none;" onclick="hapusAgenda(${i})"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>`).join(''); 
    }
    if(window.role === 'admin' || window.role === 'mod') {
        document.querySelectorAll('#agenda .admin-only').forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
    }
}

function getBadgeClass(kategori) {
    let cat = (kategori || '').toLowerCase();
    if(cat.includes('policy')) return 'badge-policy';
    if(cat.includes('riset')) return 'badge-riset';
    if(cat.includes('artikel')) return 'badge-artikel';
    if(cat.includes('kajian')) return 'badge-kajian';
    return 'badge-default';
}

// TAHAP 3: Render Repositori dengan Penulis dan Pembatasan Beranda
function renderRepositori(filterKeyword = "", filterCategory = "Semua"){ 
    let d = getSafeRepoArray();
    
    let filteredData = d.filter(x => {
        let matchKeyword = x.j.toLowerCase().includes(filterKeyword.toLowerCase());
        let matchCategory = filterCategory === "Semua" || (x.k && x.k.toLowerCase().includes(filterCategory.toLowerCase()));
        return matchKeyword && matchCategory;
    }).slice(0, 4); // Maksimal 4 di Beranda

    let container = document.getElementById('pdfContainer');
    if(!container) return;

    if(document.getElementById('repoCount')) document.getElementById('repoCount').innerText = d.length;

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="text-center py-5 my-4"><i class="fa-solid fa-folder-open text-muted opacity-25" style="font-size: 4rem; margin-bottom: 20px;"></i><h5 class="fw-bold text-light">Belum ada dokumen yang dipublikasikan</h5></div>`;
    } else {
        container.innerHTML = filteredData.map((x) => {
            let thumbHTML = x.thumb ? `<img src="${x.thumb}" class="rounded-3 shadow-sm d-none d-md-block" style="width: 100px; height: 130px; object-fit: cover;">` : `<div class="bg-light rounded-3 p-3 text-danger fs-3 d-none d-md-block shadow-sm" style="min-width: 90px; text-align: center;"><i class="fa-solid fa-file-pdf"></i></div>`;
            let statusBadge = (window.role === 'admin' || window.role === 'mod') && x.status !== 'Publish' && x.status ? `<span class="badge bg-${x.status === 'Scheduled' ? 'primary' : 'secondary'} ms-2 shadow-sm">${x.status}</span>` : '';

            return `
            <div class="doc-card bg-white d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-4 mb-3 p-4 hover-card" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 16px;">
                <div class="d-flex align-items-start gap-3 w-100">
                    ${thumbHTML}
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1 flex-wrap">
                            <span class="badge-modern ${getBadgeClass(x.k)}">${x.k || 'Dokumen'}</span>
                            ${statusBadge}
                        </div>
                        <h5 class="fw-bold text-dark-blue mb-1" style="font-size: 1.15rem;">${x.j}</h5>
                        
                        <p class="text-muted small mb-2 fw-medium"><i class="fa-solid fa-user-pen me-1"></i> ${x.p || 'Divisi Kastrat'} <span class="ms-1 me-1 opacity-50">|</span> ${x.org || 'HIMA Psikologi'}</p>
                        
                        ${x.desc ? `<p class="small text-muted mb-3" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">${x.desc}</p>` : ''}
                        
                        <div class="d-flex flex-wrap align-items-center gap-2">
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-calendar me-1"></i> ${x.y || '2026'}</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>PDF Access</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>${x.t || 'Baru Saja'}</span>
                        </div>
                    </div>
                </div>
                <div class="d-flex flex-md-column align-items-center gap-2 mt-3 mt-md-0 ms-md-auto align-self-md-stretch justify-content-center">
                    <a href="${x.l}" target="_blank" class="btn btn-dark-blue rounded-pill fw-bold shadow-sm px-4 w-100"><i class="fa-solid fa-cloud-arrow-down me-1"></i> Akses PDF</a>
                    ${(window.role === 'admin' || window.role === 'mod') ? `
                    <div class="d-flex gap-2 w-100 mt-1">
                        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 shadow-sm" onclick="bukaEditDokumen(${x.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill flex-grow-1 shadow-sm" onclick="hapusRepo(${x.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
            </div>`;
        }).join(''); 
    }
}

window.filterRepositori = function() {
    let kw = document.getElementById('searchRepoInput') ? document.getElementById('searchRepoInput').value : "";
    let cat = document.getElementById('filterRepoKategori') ? document.getElementById('filterRepoKategori').value : "Semua";
    renderRepositori(kw, cat);
};

// TAHAP 3: Render Halaman Arsip PDF Penuh
window.filterArsipPdfLengkap = function() {
    let kw = document.getElementById('searchPdfLengkap') ? document.getElementById('searchPdfLengkap').value : "";
    let cat = document.getElementById('filterPdfKategori') ? document.getElementById('filterPdfKategori').value : "Semua";
    let year = document.getElementById('filterPdfTahun') ? document.getElementById('filterPdfTahun').value : "Semua";

    let dRepo = getSafeRepoArray();

    let filteredData = dRepo.filter(x => {
        let matchKeyword = x.j.toLowerCase().includes(kw.toLowerCase()) || (x.p && x.p.toLowerCase().includes(kw.toLowerCase()));
        let matchCategory = cat === "Semua" || (x.k && x.k.toLowerCase().includes(cat.toLowerCase()));
        let docYear = x.y || (x.t ? x.t.slice(-4) : "2026");
        let matchYear = year === "Semua" || docYear === year;
        return matchKeyword && matchCategory && matchYear;
    });

    let container = document.getElementById('arsipPdfContainer');
    if(!container) return;
    
    if(document.getElementById('pdfLengkapCount')) document.getElementById('pdfLengkapCount').innerText = filteredData.length;

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="text-center py-5 my-4"><i class="fa-solid fa-folder-open text-muted opacity-25" style="font-size: 4rem; margin-bottom: 20px;"></i><h5 class="fw-bold text-dark-blue">Dokumen Tidak Ditemukan</h5><p class="text-muted">Gunakan kata kunci atau filter lain.</p></div>`;
    } else {
        container.innerHTML = filteredData.map((x) => {
            let thumbHTML = x.thumb ? `<img src="${x.thumb}" class="rounded-3 shadow-sm d-none d-md-block" style="width: 100px; height: 130px; object-fit: cover;">` : `<div class="bg-light rounded-3 p-3 text-danger fs-3 d-none d-md-block shadow-sm" style="min-width: 90px; text-align: center;"><i class="fa-solid fa-file-pdf"></i></div>`;
            let statusBadge = (window.role === 'admin' || window.role === 'mod') && x.status !== 'Publish' && x.status ? `<span class="badge bg-${x.status === 'Scheduled' ? 'primary' : 'secondary'} ms-2 shadow-sm">${x.status}</span>` : '';

            return `
            <div class="doc-card bg-white d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-4 mb-3 p-4 hover-card" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 16px;">
                <div class="d-flex align-items-start gap-3 w-100">
                    ${thumbHTML}
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1 flex-wrap">
                            <span class="badge-modern ${getBadgeClass(x.k)}">${x.k || 'Dokumen'}</span>
                            ${statusBadge}
                        </div>
                        <h5 class="fw-bold text-dark-blue mb-1" style="font-size: 1.15rem;">${x.j}</h5>
                        
                        <p class="text-muted small mb-2 fw-medium"><i class="fa-solid fa-user-pen me-1"></i> ${x.p || 'Divisi Kastrat'} <span class="ms-1 me-1 opacity-50">|</span> ${x.org || 'HIMA Psikologi'}</p>
                        
                        ${x.desc ? `<p class="small text-muted mb-3" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">${x.desc}</p>` : ''}
                        
                        <div class="d-flex flex-wrap align-items-center gap-2">
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-calendar me-1"></i> ${x.y || '2026'}</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>PDF Access</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>${x.t || 'Baru Saja'}</span>
                        </div>
                    </div>
                </div>
                <div class="d-flex flex-md-column align-items-center gap-2 mt-3 mt-md-0 ms-md-auto align-self-md-stretch justify-content-center">
                    <a href="${x.l}" target="_blank" class="btn btn-dark-blue rounded-pill fw-bold shadow-sm px-4 w-100"><i class="fa-solid fa-cloud-arrow-down me-1"></i> Akses PDF</a>
                    ${(window.role === 'admin' || window.role === 'mod') ? `
                    <div class="d-flex gap-2 w-100 mt-1">
                        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 shadow-sm" onclick="bukaEditDokumen(${x.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill flex-grow-1 shadow-sm" onclick="hapusRepo(${x.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');
    }
    
    if(window.role === 'admin' || window.role === 'mod') {
        document.querySelectorAll('#arsipPdfSection .admin-only').forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
    }
};

// ==========================================
// 6. ENGINE GAMIFICATION & PURE FIREBASE REALTIME
// ==========================================

function renderPersonalDashboard(userData) {
    if(!document.getElementById('userNameGami')) return;
    document.getElementById('userNameGami').innerText = userData.nama;
    document.getElementById('userEmailGami').innerText = userData.email;
    document.getElementById('userAvatarImg').src = userData.foto;
    document.getElementById('userPoints').innerText = userData.points;
    document.getElementById('userStreak').innerText = userData.streak;
}

function checkAndAwardBadges(uid, userData) {
    let newBadges = [];
    if(userData.votesCount >= 1 && !userData.badges?.includes("Pemilih Perdana")) newBadges.push("Pemilih Perdana");
    if(userData.votesCount >= 10 && !userData.badges?.includes("Aktivis Kampus")) newBadges.push("Aktivis Kampus");
    if(userData.points >= 100 && !userData.badges?.includes("Kritis")) newBadges.push("Kritis");
    if(userData.challengesCount >= 5 && !userData.badges?.includes("Analis Kebijakan")) newBadges.push("Analis Kebijakan");

    if(newBadges.length > 0) {
        let updatedBadges = [...(userData.badges || []), ...newBadges];
        window.db.ref('karisma_users/' + uid + '/badges').set(updatedBadges);
        Swal.fire({ title: 'Pencapaian Baru Terbuka!', text: `Selamat! Anda mendapatkan Badge: ${newBadges.join(', ')}`, icon: 'success', confirmButtonColor: '#0B192C' });
    }
}

function tambahPoinFirebase(uid, jumlahPoin) {
    const ref = window.db.ref('karisma_users/' + uid);
    ref.once('value').then(snap => {
        let d = snap.val();
        if(d) {
            d.points += jumlahPoin;
            ref.set(d);
            renderPersonalDashboard(d);
            checkAndAwardBadges(uid, d);
            Swal.fire({ title: `+${jumlahPoin} Poin!`, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        }
    });
}

function renderPollingRealtime() {
    let data = window.globalData.karisma_modern_poll;
    if(!data || !data.q) {
        if(document.getElementById('pollQuestionUI')) document.getElementById('pollQuestionUI').innerText = "Belum ada polling aktif.";
        return;
    }
    
    document.getElementById('pollQuestionUI').innerText = data.q;
    document.getElementById('pollReactionsUI').style.display = "flex";
    
    let totalVotes = data.votes ? data.votes.reduce((a, b) => a + b, 0) : 0;
    document.getElementById('pollTotalVotes').innerText = `${totalVotes} Suara`;
    
    let isVoted = window.currentUid ? localStorage.getItem('voted_' + window.currentUid + '_' + data.q) : false;
    
    document.getElementById('pollOptionsContainer').innerHTML = data.opts.map((opt, i) => {
        let count = data.votes ? (data.votes[i] || 0) : 0;
        let percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
        
        if (isVoted) {
            let isWin = percentage === Math.max(...data.votes.map(v => Math.round((v/totalVotes)*100) || 0));
            let color = isWin ? '#FFC107' : '#e9ecef';
            return `
            <div class="mb-2 position-relative rounded-3" style="background: #f8f9fa; border: 1px solid #dee2e6; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: ${color}; position: absolute; opacity: 0.3; transition: width 1s ease;"></div>
                <div class="d-flex justify-content-between p-3 position-relative z-index-1">
                    <span class="fw-bold text-dark">${opt}</span>
                    <span class="fw-bold ${isWin ? 'text-warning' : 'text-muted'}">${percentage}% <span class="small fw-normal">(${count})</span></span>
                </div>
            </div>`;
        } else {
            return `<button class="poll-option-btn w-100" onclick="submitVote(${i}, '${data.q}')"><span>${opt}</span></button>`;
        }
    }).join('');

    document.getElementById('reactFire').innerText = data.reactions?.fire || 0;
    document.getElementById('reactUp').innerText = data.reactions?.thumbsUp || 0;
    document.getElementById('reactDown').innerText = data.reactions?.thumbsDown || 0;
}

function submitVote(idx, questionKey) {
    if(!window.currentUid) return Swal.fire('Akses Ditolak', 'Harap login terlebih dahulu untuk memberikan suara.', 'warning');
    
    let data = window.globalData.karisma_modern_poll;
    if(!data.votes) data.votes = new Array(data.opts.length).fill(0);
    data.votes[idx] += 1;
    
    window.db.ref('karisma_modern_poll').set(data);
    localStorage.setItem('voted_' + window.currentUid + '_' + questionKey, 'true');
    
    const userRef = window.db.ref('karisma_users/' + window.currentUid);
    userRef.once('value').then(snap => {
        let ud = snap.val();
        if(ud) { ud.votesCount += 1; userRef.set(ud); }
    });
    tambahPoinFirebase(window.currentUid, 2); 
}

function kirimReaksi(type) {
    let data = window.globalData.karisma_modern_poll;
    if(!data.reactions) data.reactions = { fire:0, thumbsUp:0, thumbsDown:0 };
    data.reactions[type] += 1;
    window.db.ref('karisma_modern_poll/reactions').set(data.reactions);
}

function renderDailyChallenge() {
    let data = window.globalData.karisma_daily;
    if(!data || !data.q) {
        if(document.getElementById('dailyQuestionUI')) document.getElementById('dailyQuestionUI').innerText = "Belum ada tantangan hari ini.";
        return;
    }
    
    document.getElementById('dailyTitleUI').innerText = data.title;
    document.getElementById('dailyQuestionUI').innerText = data.q;
    
    let isDone = window.currentUid ? localStorage.getItem('daily_done_' + window.currentUid + '_' + data.date) : false;
    let resBox = document.getElementById('dailyResult');
    
    if(isDone) {
        document.getElementById('dailyOptionsContainer').innerHTML = `<p class="text-success bg-white p-3 rounded-3 fw-bold shadow-sm"><i class="fa-solid fa-circle-check me-2"></i>Tantangan diselesaikan!</p>`;
        resBox.classList.remove('d-none'); resBox.classList.add('bg-light', 'text-dark-blue');
        resBox.innerHTML = `<strong>💡 Penjelasan:</strong><br><span style="font-size:0.95rem;">${data.exp}</span>`;
    } else {
        resBox.classList.add('d-none');
        document.getElementById('dailyOptionsContainer').innerHTML = data.opts.map((opt, i) => 
            `<button class="btn btn-outline-light text-start p-3 rounded-4 w-100 shadow-sm" style="line-height: 1.5; font-size: 0.95rem; white-space: normal;" onclick="jawabDaily(${i}, ${data.ans}, '${data.exp}', '${data.date}')">${opt}</button>`
        ).join('');
    }
}

function jawabDaily(idxSelected, idxBenar, exp, dateKey) {
    if(!window.currentUid) return Swal.fire('Akses Ditolak', 'Harap login untuk menjawab tantangan.', 'warning');
    
    localStorage.setItem('daily_done_' + window.currentUid + '_' + dateKey, 'true');
    let resBox = document.getElementById('dailyResult');
    resBox.classList.remove('d-none', 'bg-light', 'text-dark-blue', 'bg-success', 'bg-danger');
    
    const userRef = window.db.ref('karisma_users/' + window.currentUid);
    userRef.once('value').then(snap => { let ud = snap.val(); if(ud) { ud.challengesCount += 1; userRef.set(ud); } });

    if(idxSelected === idxBenar) {
        tambahPoinFirebase(window.currentUid, 20);
        resBox.classList.add('bg-success', 'text-white');
        resBox.innerHTML = `<strong>Jawaban Benar! (+20 Poin)</strong><br>${exp}`;
    } else {
        tambahPoinFirebase(window.currentUid, 5);
        resBox.classList.add('bg-danger', 'text-white');
        resBox.innerHTML = `<strong>Kurang Tepat. (+5 Poin Partisipasi)</strong><br>💡 Penjelasan:<br>${exp}`;
    }
    document.getElementById('dailyOptionsContainer').style.display = 'none';
}

function renderLeaderboard() {
    let usersData = window.globalData.karisma_users;
    let lbContainer = document.getElementById('leaderboardContainer');
    if(!lbContainer) return;

    if(!usersData) {
        lbContainer.innerHTML = `<p class="text-muted small text-center my-3">Belum ada peringkat minggu ini.</p>`;
        return;
    }

    let limit = window.globalData.karisma_leaderboard_limit || 3;
    let usersArray = Object.values(usersData).filter(u => u.points > 0).sort((a, b) => b.points - a.points).slice(0, limit);
    
    if(usersArray.length === 0) {
        lbContainer.innerHTML = `<p class="text-muted small text-center my-3">Belum ada mahasiswa yang memperoleh poin minggu ini.</p>`;
        return;
    }

    let htmlContent = usersArray.map((u, i) => {
        let badgeStyle = i === 0 ? 'bg-warning text-dark' : (i === 1 ? 'bg-secondary text-white' : (i === 2 ? 'bg-danger text-white' : 'bg-light text-muted border'));
        let shortName = u.nama.split(' ')[0];
        
        return `
        <div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded-3 hover-card" style="background: #ffffff; border: 1px solid #f8f9fa;">
            <div class="d-flex align-items-center gap-3">
                <span class="fw-bold ${i < 3 ? 'text-dark-blue fs-5' : 'text-muted'}">${i + 1}</span>
                <img src="${u.foto || 'https://via.placeholder.com/150'}" class="rounded-circle border" style="width:35px; height:35px; object-fit:cover;">
                <div>
                    <span class="fw-bold fs-6 text-dark-blue d-block" style="line-height:1;">${shortName}</span>
                    <small class="text-muted" style="font-size:10px;">${u.role === 'mod' ? 'Admin Kastrat' : 'Mahasiswa'}</small>
                </div>
            </div>
            <span class="badge ${badgeStyle} rounded-pill px-3 py-2 shadow-sm">${u.points} Pts</span>
        </div>`;
    }).join('');

    if(window.role === 'admin' || window.role === 'mod') {
        htmlContent += `<button class="btn btn-sm btn-outline-secondary w-100 mt-2 admin-only" onclick="editLimitLeaderboard()"><i class="fa-solid fa-gear me-1"></i>Atur Batas Peringkat</button>`;
    }

    lbContainer.innerHTML = htmlContent;
}

async function editLimitLeaderboard() {
    const { value: limit } = await Swal.fire({
        title: 'Pengaturan Leaderboard',
        input: 'number',
        inputLabel: 'Jumlah maksimal peringkat yang ditampilkan di halaman utama:',
        inputValue: window.globalData.karisma_leaderboard_limit || 3,
        showCancelButton: true,
        confirmButtonColor: '#0B192C'
    });
    
    if (limit && parseInt(limit) > 0) {
        window.db.ref('karisma_leaderboard_limit').set(parseInt(limit));
        Swal.fire({title: 'Tersimpan', text: 'Batas tampilan leaderboard berhasil diperbarui.', icon: 'success', timer: 1500, showConfirmButton: false});
    }
}

// ==========================================
// 7. SENSOR KLIK UNTUK FITUR EDIT LANGSUNG
// ==========================================
document.addEventListener('click', function(e) {
    if((window.role === 'admin' || window.role === 'mod')) {
        const targetEl = e.target.closest('.editable-text');
        if(targetEl && targetEl.id) {
            e.preventDefault(); 
            let labelText = targetEl.innerText.trim();
            let label = labelText.length > 20 ? labelText.substring(0, 20) + "..." : labelText;
            if(typeof editTeks === 'function') { editTeks(targetEl.id, label); }
        }
    }
});

// ==========================================
// 8. SISTEM OTENTIKASI & LOGIN (FIREBASE AUTH)
// ==========================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        window.currentUid = user.uid;
        window.role = 'mahasiswa'; 
        
        const userRef = window.db.ref('karisma_users/' + user.uid);
        userRef.once('value').then(snap => {
            if (!snap.exists()) {
                userRef.set({
                    nama: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    foto: user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'M'),
                    points: 0, streak: 1, role: window.role, badges: ['Pemilih Perdana'], votesCount: 0, challengesCount: 0
                });
            } else {
                let d = snap.val();
                d.foto = user.photoURL || d.foto; 
                window.role = d.role || window.role; 
                userRef.set(d);
                if(typeof renderPersonalDashboard === 'function') renderPersonalDashboard(d);
            }
        });

        let loginModalEl = document.getElementById('loginModal');
        if(loginModalEl) { let loginModal = bootstrap.Modal.getInstance(loginModalEl); if(loginModal) loginModal.hide(); }

        let btnPortal = document.getElementById('loginBtnText');
        if(btnPortal) {
            btnPortal.innerHTML = `<i class="fa-solid fa-user-check me-1"></i> Halo, ${user.displayName ? user.displayName.split(' ')[0] : 'Kastrat'}`;
            btnPortal.setAttribute('data-bs-target', '');
            btnPortal.onclick = logoutSistem;
            btnPortal.classList.replace('btn-outline-primary', 'btn-primary');
            btnPortal.classList.add('bg-dark-blue');
        }

        if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';

        if((window.role === 'admin' || window.role === 'mod') && typeof renderCMSDashboard === 'function') {
            document.getElementById('adminDashboard').style.setProperty('display', 'block', 'important');
            renderCMSDashboard();
        }

        Swal.fire({title: 'Berhasil Masuk', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});
        
    } else {
        window.currentUid = null;
        window.role = 'guest';
        
        let btnPortal = document.getElementById('loginBtnText');
        if(btnPortal) {
            btnPortal.innerHTML = `<i class="fa-solid fa-right-to-bracket me-1"></i> Portal`;
            btnPortal.setAttribute('data-bs-target', '#loginModal');
            btnPortal.onclick = null;
            btnPortal.classList.replace('btn-primary', 'btn-outline-primary');
            btnPortal.classList.remove('bg-dark-blue');
        }
        
        if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'flex';
        if(document.getElementById('adminDashboard')) document.getElementById('adminDashboard').style.setProperty('display', 'none', 'important');
    }
});

window.loginDenganGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch((error) => {
        Swal.fire('Gagal Login', error.message, 'error');
    });
};

// FUNGSI LOGIN GOOGLE (ANTI-BLOKIR SAFARI/IOS)
window.loginDenganGoogle = function() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // PENTING: Untuk iPhone/Safari, eksekusi HARUS sinkron (tanpa jeda Swal.fire)
    // agar Safari tidak memblokir Cookie dan Popup Auth.
    firebase.auth().signInWithPopup(googleProvider).then((result) => {
        handleUserLogin(result.user, true);
    }).catch((error) => {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
            // Jika Popup diblokir (khas iOS ketat), paksa gunakan mode Redirect secara langsung
            firebase.auth().signInWithRedirect(googleProvider);
        } else {
            Swal.fire({title: 'Gagal Autentikasi', text: error.message, icon: 'error'});
        }
    });
};

window.logoutSistem = function() {
    Swal.fire({
        title: 'Keluar dari Portal?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar',
        confirmButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            firebase.auth().signOut();
        }
    });
};
// ==========================================
// FIX BUG IOS: PAKSA SAFARI RE-RENDER HEADER MERAH
// ==========================================
window.addEventListener('load', () => {
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 500); // Menendang ulang perhitungan layar setelah 0.5 detik
});
