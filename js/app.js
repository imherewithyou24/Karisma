// ==========================================
// 1. SYSTEM LISTENER DATABASE CLOUD REALTIME
// ==========================================
window.db.ref().on('value', (snapshot) => {
    window.globalData = snapshot.val() || {};
    updateUISecaraRealtime();
});

function updateUISecaraRealtime() {
    // 1. SMART DETECTION: Update teks
    document.querySelectorAll('.editable-text').forEach(el => {
        if(el.id) {
            // Hanya ganti teks jika datanya valid dan tidak kosong
            if(window.globalData[el.id] !== undefined && window.globalData[el.id].trim() !== '') {
                el.innerText = window.globalData[el.id]; 
            }
            if(window.globalData['font_' + el.id]) {
                el.style.fontFamily = window.globalData['font_' + el.id];
            } else {
                el.style.fontFamily = ""; 
            }
        }
    });

    // 2. FIX BUG IPHONE: Render Gambar dengan Filter Ketat
    const imgIds = ['heroBg', 'logo1', 'logo2', 'logo3'];
    imgIds.forEach(id => {
        // HANYA pasang gambar jika link-nya valid (lebih dari 5 huruf/bukan kosong)
        if(window.globalData[id] && window.globalData[id].length > 5) {
            if(id === 'heroBg') {
                // Dipecah spesifik agar Safari iOS tidak bingung membacanya
                let heroEl = document.getElementById('heroSection');
                heroEl.style.backgroundImage = `linear-gradient(rgba(11, 25, 44, 0.85), rgba(11, 25, 44, 0.9)), url('${window.globalData[id]}')`;
                heroEl.style.backgroundSize = 'cover';
                heroEl.style.backgroundPosition = 'center';
                heroEl.style.backgroundRepeat = 'no-repeat';
            } else if(document.getElementById(id)) {
                document.getElementById(id).src = window.globalData[id];
            }
        }
    });

    // 3. Sinkronisasi warna
    if(window.globalData.karisma_theme) {
        document.documentElement.style.setProperty('--dark-blue', window.globalData.karisma_theme);
    }
    
    // 4. Render Modul Lain
    renderTracker();
    renderAgenda();
    renderRepositori();
    if(document.getElementById('searchInput')) cariBerita(); 
    if(window.activeNewsId) renderKomentar(window.activeNewsId); 
    
    // 5. Gamifikasi
    renderPollingRealtime();
    renderDailyChallenge();
    renderLeaderboard();
    
    // 6. Update stat
    let inboxD = window.globalData.karisma_inbox || [];
    if(document.getElementById('statInbox')) document.getElementById('statInbox').innerText = inboxD.length;
    if(window.globalData.karisma_visitors && document.getElementById('statVisitor')) {
        document.getElementById('statVisitor').innerText = window.globalData.karisma_visitors.toLocaleString();
    }
}

// ==========================================
// 2. LOGIKA PENGUNJUNG MURNI (ANTI-BUG VISITOR)
// ==========================================
if(!sessionStorage.getItem('visited')) {
    window.db.ref('karisma_visitors').once('value').then(snap => {
        let v = snap.val() || 0; 
        window.db.ref('karisma_visitors').set(v + 1);
        sessionStorage.setItem('visited', 'true');
    });
}

// ==========================================
// 3. FITUR KAWAL ISU & PORTAL BERITA KAJIAN
// ==========================================
function renderBeritaList(dataArray) {
    let container = document.getElementById('dynamicNewsContainer'); 
    if(!container) return; container.innerHTML = '';
    if(!dataArray || dataArray.length === 0) { 
        container.innerHTML = '<p class="text-center text-muted py-4">Kajian tidak ditemukan.</p>'; 
        return; 
    }
    
    const admDisp = window.role === 'admin' || window.role === 'mod' ? 'block' : 'none';
    dataArray.forEach(n => {
        container.innerHTML += `
        <div class="col-md-4">
            <div class="card h-100 shadow-sm border-0 hover-card rounded-4 bg-white overflow-hidden">
                <img src="${n.img}" class="card-img-top" style="height:200px; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=600'">
                <div class="card-body d-flex flex-column">
                    <span class="badge ${n.color || 'bg-secondary'} mb-2 align-self-start">${n.badge}</span>
                    <h5 class="card-title fw-bold mt-2 text-dark">${n.title}</h5>
                    <button class="btn btn-outline-primary rounded-pill mt-auto w-100 fw-bold" onclick='bukaBacaBerita(${n.id})'>Baca Kajian</button>
                    <div class="admin-only gap-2 mt-2 pt-2 border-top" style="display:${admDisp} !important;">
                        <button class="btn btn-sm btn-danger w-100" onclick="hapusBerita(${n.id})"><i class="fa-solid fa-trash me-1"></i> Hapus Postingan</button>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

function cariBerita() {
    let kw = document.getElementById('searchInput').value.toLowerCase(); 
    let dbNews = window.globalData.karisma_news || [];
    if(kw === '') { 
        const hr = new Date().getHours(); 
        let startIdx = (hr * 3) % Math.max(1, dbNews.length);
        renderBeritaList(dbNews.slice(startIdx, startIdx + 3)); 
    } else { 
        renderBeritaList(dbNews.filter(n => n.title.toLowerCase().includes(kw)).slice(0, 6)); 
    }
}

function bukaBacaBerita(id) {
    let dbNews = window.globalData.karisma_news; 
    const n = dbNews.find(x => x.id === id); 
    window.activeNewsId = id; 
    document.getElementById('modalNewsImg').src = n.img; 
    document.getElementById('modalNewsBadge').className = `badge ${n.color || 'bg-danger'} mb-3 fs-6`;
    document.getElementById('modalNewsBadge').innerText = n.badge; 
    document.getElementById('modalNewsTitle').innerText = n.title; 
    document.getElementById('modalNewsContent').innerHTML = n.full;
    renderKomentar(id); 
    new bootstrap.Modal(document.getElementById('newsReaderModal')).show();
}

function renderKomentar(id) {
    const d = window.globalData['komentar_berita_' + id] || [];
    let html = d.length === 0 ? '<p class="text-muted small py-2">Belum ada diskusi publik. Tulis pandangan Anda di bawah!</p>' : d.map((k, i) => {
        let badge = k.role === 'admin' || k.role === 'mod' ? '<span class="badge bg-warning text-dark ms-2"><i class="fa-solid fa-star"></i> Admin Kastrat</span>' : '';
        let delBtn = window.role === 'mod' ? `<button class="btn btn-sm text-danger position-absolute top-0 end-0 m-2 border-0 bg-transparent" onclick="hapusKomenDewa(${id}, ${i})"><i class="fa-solid fa-xmark fa-lg"></i></button>` : '';
        return `<div class="comment-box position-relative"><h6 class="fw-bold mb-1">${k.nama} ${badge} <span class="text-muted small ms-2 fw-normal">${k.waktu}</span></h6><p class="mb-0 text-dark">${k.isi}</p>${delBtn}</div>`;
    }).join('');
    document.getElementById('commentList').innerHTML = html;
}

function tambahKomentar() {
    let isi = document.getElementById('isiKomentar').value; 
    if(isi.trim() === '') return;
    let d = window.globalData['komentar_berita_' + window.activeNewsId] || [];
    d.push({ nama: document.getElementById('namaKomentator').value || 'Anonim', isi: isi, role: window.role, waktu: new Date().toLocaleDateString('id-ID') });
    window.db.ref('komentar_berita_' + window.activeNewsId).set(d);
    document.getElementById('isiKomentar').value = '';
}

// ==========================================
// 4. RENDER TRACKER, AGENDA, & PDF REPOSITORY
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

// Fungsi Penentu Warna Kategori Dinamis
function getBadgeClass(kategori) {
    let cat = (kategori || '').toLowerCase();
    if(cat.includes('policy')) return 'badge-policy';
    if(cat.includes('riset')) return 'badge-riset';
    if(cat.includes('artikel')) return 'badge-artikel';
    if(cat.includes('kajian')) return 'badge-kajian';
    return 'badge-default';
}

// Render Dashboard PDF Baru
function renderRepositori(filterKeyword = "", filterCategory = "Semua"){ 
    let dRepo = [
        { j:"Kajian Kebijakan UKT Nominal 2026", k:"Kajian Kastrat", t:"12 Juli 2026", l:"#" },
        { j:"Policy Brief RUU Penyiaran", k:"Policy Brief", t:"05 Juli 2026", l:"#" }
    ];
    let d = window.globalData.karisma_repo || dRepo; 
    
    // Mesin Filter & Pencarian
    let filteredData = d.filter(x => {
        let matchKeyword = x.j.toLowerCase().includes(filterKeyword.toLowerCase());
        let matchCategory = filterCategory === "Semua" || (x.k && x.k.toLowerCase().includes(filterCategory.toLowerCase()));
        return matchKeyword && matchCategory;
    });

    let container = document.getElementById('pdfContainer');
    if(!container) return;

    // Update Angka Jumlah Dokumen
    if(document.getElementById('repoCount')) document.getElementById('repoCount').innerText = filteredData.length;

    // 1. Tampilan "Empty State" (Jika File Kosong/Tidak Ditemukan)
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 my-4">
                <i class="fa-solid fa-folder-open text-muted opacity-25" style="font-size: 4rem; margin-bottom: 20px;"></i>
                <h5 class="fw-bold text-dark-blue">Belum ada dokumen</h5>
                <p class="text-muted">Gunakan kata kunci lain atau unggah dokumen baru dari Mode Dewa.</p>
            </div>`;
    } 
    // 2. Tampilan Card List Modern
    else {
        container.innerHTML = filteredData.map((x, i) => {
            // Index asli untuk penghapusan
            let originalIndex = d.findIndex(item => item.j === x.j && item.l === x.l);
            
            return `
            <div class="doc-card d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <div class="d-flex align-items-start gap-3">
                    <div class="bg-light rounded-3 p-3 text-danger fs-3 d-none d-md-block shadow-sm">
                        <i class="fa-solid fa-file-pdf"></i>
                    </div>
                    <div>
                        <h5 class="fw-bold text-dark-blue mb-2">${x.j}</h5>
                        <div class="d-flex flex-wrap align-items-center gap-2">
                            <span class="badge-modern ${getBadgeClass(x.k)}">${x.k || 'Dokumen'}</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>PDF • ${Math.floor(Math.random() * 2 + 1)}.${Math.floor(Math.random() * 9)} MB</span>
                            <span class="text-muted small fw-medium"><i class="fa-solid fa-circle mx-2" style="font-size: 4px; color: #dee2e6; vertical-align: middle;"></i>${x.t || 'Baru Saja'}</span>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 mt-2 mt-md-0 justify-content-md-end">
                    <a href="${x.l}" target="_blank" class="btn btn-download"><i class="fa-solid fa-cloud-arrow-down me-1"></i> Download</a> 
                    <button class="btn btn-delete-modern admin-only" style="display:none;" onclick="hapusRepo(${originalIndex})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join(''); 
    }

    if(window.role === 'admin' || window.role === 'mod') {
        document.querySelectorAll('#repositori .admin-only').forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
    }
}

// Fungsi Pemicu Interaksi Saat Ngetik di Search Bar
window.filterRepositori = function() {
    let kw = document.getElementById('searchRepoInput') ? document.getElementById('searchRepoInput').value : "";
    let cat = document.getElementById('filterRepoKategori') ? document.getElementById('filterRepoKategori').value : "Semua";
    renderRepositori(kw, cat);
};

// ==========================================
// 5. ENGINE GAMIFICATION PURE FIREBASE REALTIME
// ==========================================

function renderPersonalDashboard(userData) {
    if(!document.getElementById('userNameGami')) return;
    document.getElementById('userNameGami').innerText = userData.nama;
    document.getElementById('userEmailGami').innerText = userData.email;
    document.getElementById('userAvatarImg').src = userData.foto;
    document.getElementById('userPoints').innerText = userData.points;
    document.getElementById('userStreak').innerText = userData.streak;
    
    // Render Badges
    let badgeContainer = document.getElementById('badgesContainer');
    if(!userData.badges || userData.badges.length === 0) {
        badgeContainer.innerHTML = `<span class="badge bg-light text-muted border w-100 py-2">Belum ada pencapaian. Mulaiah berinteraksi!</span>`;
    } else {
        badgeContainer.innerHTML = userData.badges.map(b => `<span class="badge bg-warning text-dark-blue shadow-sm py-2 px-3"><i class="fa-solid fa-award me-1"></i> ${b}</span>`).join('');
    }
}

// Cek Syarat Badge Secara Otomatis
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

// --- 5.1 LIVE POLLING REALTIME ---
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
    
    // Cek apakah user saat ini sudah vote dari data realtime (kita gunakan local flag sbg pengaman UI agar tidak spam klik)
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
    
    // Tambah poin dan riwayat aktivitas ke Firebase
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

// --- 5.2 TANTANGAN KRITIS REALTIME ---
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
        document.getElementById('dailyOptionsContainer').innerHTML = `<p class="text-success bg-white p-3 rounded-3 fw-bold"><i class="fa-solid fa-circle-check me-2"></i>Tantangan diselesaikan!</p>`;
        resBox.classList.remove('d-none'); resBox.classList.add('bg-light', 'text-dark-blue');
        resBox.innerHTML = `<strong>💡 Penjelasan:</strong><br>${data.exp}`;
    } else {
        resBox.classList.add('d-none');
        document.getElementById('dailyOptionsContainer').innerHTML = data.opts.map((opt, i) => 
            `<button class="btn btn-outline-light text-start py-2 px-3 rounded-pill" onclick="jawabDaily(${i}, ${data.ans}, '${data.exp}', '${data.date}')">${opt}</button>`
        ).join('');
    }
}

function jawabDaily(idxSelected, idxBenar, exp, dateKey) {
    if(!window.currentUid) return Swal.fire('Akses Ditolak', 'Harap login untuk menjawab tantangan.', 'warning');
    
    localStorage.setItem('daily_done_' + window.currentUid + '_' + dateKey, 'true');
    let resBox = document.getElementById('dailyResult');
    resBox.classList.remove('d-none', 'bg-light', 'text-dark-blue', 'bg-success', 'bg-danger');
    
    // Tambah hitungan challenge ke akun user
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

// --- 5.3 LEADERBOARD REALTIME ---
function renderLeaderboard() {
    // Tarik data users, ubah ke array, urutkan berdasarkan poin terbesar
    let usersData = window.globalData.karisma_users;
    let lbContainer = document.getElementById('leaderboardContainer');
    if(!lbContainer) return;

    if(!usersData) {
        lbContainer.innerHTML = `<p class="text-muted small text-center my-3">Belum ada peringkat minggu ini.</p>`;
        return;
    }

    let usersArray = Object.values(usersData).filter(u => u.points > 0).sort((a, b) => b.points - a.points).slice(0, 10);
    
    if(usersArray.length === 0) {
        lbContainer.innerHTML = `<p class="text-muted small text-center my-3">Belum ada mahasiswa yang memperoleh poin minggu ini.</p>`;
        return;
    }

    lbContainer.innerHTML = usersArray.map((u, i) => {
        let badgeStyle = i === 0 ? 'bg-warning text-dark' : (i === 1 ? 'bg-secondary text-white' : (i === 2 ? 'bg-danger text-white' : 'bg-light text-muted border'));
        let shortName = u.nama.split(' ')[0];
        
        return `
        <div class="d-flex align-items-center justify-content-between p-2 rounded-3 hover-card">
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
}

// ==========================================
// 6. SENSOR KLIK UNTUK FITUR EDIT LANGSUNG (ADMIN ONLY)
// ==========================================
document.addEventListener('click', function(e) {
    // Jika yang klik adalah Admin, dan elemen yang diklik punya class "editable-text"
    if((window.role === 'admin' || window.role === 'mod')) {
        const targetEl = e.target.closest('.editable-text');
        if(targetEl && targetEl.id) {
            e.preventDefault(); // Mencegah pindah halaman jika teks berupa link
            
            // Ambil sedikit potongan teks aslinya untuk dijadikan judul pop-up
            let labelText = targetEl.innerText.trim();
            let label = labelText.length > 20 ? labelText.substring(0, 20) + "..." : labelText;
            
            if(typeof editTeks === 'function') {
                editTeks(targetEl.id, label);
            }
        }
    }
});
