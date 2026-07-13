// ==========================================
// 1. SYSTEM LISTENER DATABASE CLOUD REALTIME
// ==========================================
window.db.ref().on('value', (snapshot) => {
    window.globalData = snapshot.val() || {};
    updateUISecaraRealtime();
});

function updateUISecaraRealtime() {
    // Render komponen teks dinamis dari cloud
    const textIds = ['teksBannerUtama', 'teksBannerSub', 'teksKutipan', 'teksProfilDetail', 'teksTtd1', 'teksTtd2', 'teksMarquee', 'tekaTekiSoal'];
    textIds.forEach(id => {
        if(window.globalData[id] && document.getElementById(id)) {
            document.getElementById(id).innerText = window.globalData[id]; 
        }
    });

    // Render komponen gambar/logo dari cloud
    const imgIds = ['heroBg', 'logo1', 'logo2', 'logo3'];
    imgIds.forEach(id => {
        if(window.globalData[id]) {
            if(id === 'heroBg') {
                document.getElementById('heroSection').style.backgroundImage = `linear-gradient(rgba(11, 25, 44, 0.85), rgba(11, 25, 44, 0.9)), url('${window.globalData[id]}')`;
            } else if(document.getElementById(id)) {
                document.getElementById(id).src = window.globalData[id];
            }
        }
    });

    // Sinkronisasi warna tema dewa kustom
    if(window.globalData.karisma_theme) {
        document.documentElement.style.setProperty('--dark-blue', window.globalData.karisma_theme);
    }
    
    // Panggil fungsi render untuk modul-modul dinamis
    renderTracker();
    renderAgenda();
    renderRepositori();
    loadCurrentPoll();
    if(document.getElementById('searchInput')) cariBerita(); 
    if(window.activeNewsId) renderKomentar(window.activeNewsId); 
    
    // Tampilkan statistik data realtime di dashboard
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
        // Ambil porsi indeks berita secara dinamis agar terlihat berotasi berkala
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

function renderRepositori(){ 
    let dRepo = [{ j:"Tata Tertib MABA 2026", k:"Kajian Kastrat", t:"Agustus 17 2026", l:"#" }];
    let d = window.globalData.karisma_repo || dRepo; 
    if(document.getElementById('pdfContainer')) {
        document.getElementById('pdfContainer').innerHTML = d.map((x, i) => `
            <tr>
                <td class="text-dark fw-bold">${x.j}</td>
                <td class="text-center"><span class="badge bg-secondary">${x.k || 'Kajian'}</span></td>
                <td class="text-center">
                    <a href="${x.l}" target="_blank" class="btn btn-sm btn-primary fw-bold rounded-pill px-3 shadow-sm"><i class="fa-solid fa-download me-1"></i> Unduh</a> 
                    <button class="btn btn-sm btn-danger admin-only ms-1 shadow-sm" style="display:none;" onclick="hapusRepo(${i})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`).join(''); 
    }
    if(window.role === 'admin' || window.role === 'mod') {
        document.querySelectorAll('#repositori .admin-only').forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
    }
}

// ==========================================
// 5. MODUL INTERAKTIF & UTILITAS GLOBAL
// ==========================================
const pollDataDefault = [
    { q: "Penilaian Anda terhadap draf RUU Penyiaran?", opts: ["Menolak Keras", "Perlu dikaji ulang", "Mendukung"], stats: [78, 15, 7] },
    { q: "Apakah Transparansi UKT di ULM sudah ideal?", opts: ["Sudah Adil", "Kurang Sosialisasi", "Sangat Memberatkan"], stats: [12, 35, 53] }
];
let window_cPoll = 0;

function loadCurrentPoll() {
    let pd = window.globalData.karisma_poll || pollDataDefault;
    if(window_cPoll >= pd.length) { 
        document.getElementById('pollQuestion').innerText = "Terima kasih! Semua voting isu telah selesai diikuti."; 
        document.getElementById('pollOptionsBox').style.display = 'none'; 
        return;
    }
    if(document.getElementById('pollProgressTxt')) {
        document.getElementById('pollProgressTxt').innerText = `Isu ${window_cPoll + 1} dari ${pd.length}`;
        document.getElementById('pollQuestion').innerText = pd[window_cPoll].q;
        document.getElementById('pollOptionsBox').style.display = 'grid';
        document.getElementById('pollResultsBox').style.display = 'none';
        
        const buttons = document.getElementById('pollOptionsBox').getElementsByTagName('button');
        if(buttons.length >= 3) {
            buttons[0].innerText = `A. ${pd[window_cPoll].opts[0]}`;
            buttons[1].innerText = `B. ${pd[window_cPoll].opts[1]}`;
            buttons[2].innerText = `C. ${pd[window_cPoll].opts[2]}`;
        }
    }
}

function jawabPoll(idxOption) {
    document.getElementById('pollOptionsBox').style.display = 'none';
    document.getElementById('pollResultsBox').style.display = 'block';
    
    let pd = window.globalData.karisma_poll || pollDataDefault;
    pd[window_cPoll].stats[idxOption] = parseInt(pd[window_cPoll].stats[idxOption]) + 1;
    window.db.ref('karisma_poll').set(pd);
    
    const s = pd[window_cPoll].stats;
    const colors = ["bg-danger", "bg-warning text-dark", "bg-primary"];
    
    document.getElementById('pollBars').innerHTML = pd[window_cPoll].opts.map((o, x) => `
        <div class="mb-3 text-start">
            <div class="d-flex justify-content-between mb-1"><span class="fw-bold text-dark">${o}</span><span class="text-dark">${s[x]} Suara</span></div>
            <div class="progress" style="height: 20px;"><div class="progress-bar ${colors[x]}" style="width: 100%"></div></div>
        </div>`).join('');
        
    setTimeout(() => { window_cPoll++; loadCurrentPoll(); }, 3500);
}

let kq = 0, kstep = 0;
const kSoal = [
    {q: "Jika ada kebijakan rektorat yang merugikan mahasiswa, apa aksi pertama Anda?", o: ["Bikin forum diskusi & kajian tertulis (2)", "Konsolidasi massa & langsung demo aksi (3)", "Biarin saja, fokus kuliah sendiri (1)"]},
    {q: "Siapa figur tokoh pergerakan nasional yang paling Anda kagumi?", o: ["Munir Said Thalib (3)", "Najwa Shihab (2)", "Tidak punya tokoh idola (1)"]}
];

function mulaiKuis() { kq = 0; kstep = 0; renderKuis(); }
function renderKuis() {
    const b = document.getElementById('quizContainer');
    if(!b) return;
    if(kstep >= kSoal.length) {
        let hasil = kq >= 5 ? "Tipe: Aktivis Radikal & Kritis 🔥" : "Tipe: Akademisi Pasif & Pengamat 📚";
        b.innerHTML = `<div class="text-center p-4 bg-light rounded-4 border"><h3 class="fw-bold text-dark">${hasil}</h3><button class="btn btn-dark mt-3 rounded-pill px-4 fw-bold" onclick="mulaiKuis()">Ulangi Tes Kepribadian</button></div>`;
        return;
    }
    b.innerHTML = `
        <h5 class="fw-bold mb-4 text-center text-dark">${kSoal[kstep].q}</h5>
        <div class="d-grid gap-2">
            <button class="btn btn-outline-dark text-start p-3 rounded-3 fw-medium" onclick="kq+=${parseInt(kSoal[kstep].o[0].slice(-2,-1))};kstep++;renderKuis()">${kSoal[kstep].o[0].slice(0,-4)}</button>
            <button class="btn btn-outline-dark text-start p-3 rounded-3 fw-medium" onclick="kq+=${parseInt(kSoal[kstep].o[1].slice(-2,-1))};kstep++;renderKuis()">${kSoal[kstep].o[1].slice(0,-4)}</button>
        </div>`;
}

function toggleDarkMode() { 
    document.body.classList.toggle('dark-mode'); 
    document.getElementById('darkModeIcon').className = document.body.classList.contains('dark-mode') ? 'fa-solid fa-sun fs-4 text-warning' : 'fa-solid fa-moon fs-4 text-white'; 
}

function shareTo(platform) { 
    let u = encodeURIComponent(window.location.href); 
    let t = encodeURIComponent(`Mari kawal pergerakan mahasiswa melalui website portal KARISMA HIMA Psikologi ULM!`); 
    if(platform === 'whatsapp') window.open(`https://api.whatsapp.com/send?text=${t}%20${u}`); 
    if(platform === 'copy') { 
        navigator.clipboard.writeText(window.location.href); 
        Swal.fire({title: 'Tautan Berhasil Disalin!', icon: 'success', confirmButtonColor: '#0B192C'}); 
    } 
}
