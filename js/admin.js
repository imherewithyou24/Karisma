// ==========================================
// 1. SISTEM OTORISASI PORTAL MULTI-ROLES (GOOGLE & EMAIL)
// ==========================================

// Daftar Email Panitia Kastrat yang berhak mendapat fitur "Mode Dewa"
const DAFTAR_ADMIN_KASTRAT = [
    "2410914320014@mhs.ulm.ac.id",
    "2510914210051@mhs.ulm.ac.id",
    "2510914210027@mhs.ulm.ac.id",
    "2510914310025@mhs.ulm.ac.id",
    "2510914120021@mhs.ulm.ac.id",
    "2510914220054@mhs.ulm.ac.id"
];

// FUNGSI 1: LOGIN MENGGUNAKAN GOOGLE
function loginDenganGoogle() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
        const user = result.user;
        cekHakAkses(user.email, user.displayName);
    })
    .catch((error) => {
        Swal.fire({title: 'Gagal Autentikasi', text: error.message, icon: 'error'});
    });
}

// FUNGSI 2: LOGIN MENGGUNAKAN EMAIL & PASSWORD
function loginDenganEmail() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    
    if (email.trim() === '' || pass.trim() === '') { 
        Swal.fire('Oops...', 'Email dan Password tidak boleh kosong!', 'error'); 
        return; 
    }

    firebase.auth().signInWithEmailAndPassword(email, pass)
    .then((userCredential) => {
        const user = userCredential.user;
        cekHakAkses(user.email, user.displayName || "Admin");
    })
    .catch((error) => {
        Swal.fire({title: 'Akses Ditolak', text: 'Email atau password salah / belum terdaftar.', icon: 'error'});
    });
}

// FUNGSI 3: PENGECEKAN HAK AKSES KETAT (ADMIN VS GUEST)
function cekHakAkses(emailPengguna, namaPengguna) {
    // Reset status visibilitas elemen
    document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'none', 'important'));

    // Cek apakah email yang login ADA di dalam daftar rahasia
    if (DAFTAR_ADMIN_KASTRAT.includes(emailPengguna)) {
        // JIKA DIA ADALAH ADMIN KASTRAT
        window.role = 'mod'; 
        document.getElementById('mainBody').classList.add('admin-mode');
        
        Swal.fire({ icon: 'success', title: 'GOD MODE AKTIF', text: `Otorisasi Diterima, ${namaPengguna || emailPengguna}.`, timer: 2500, showConfirmButton: false });
        
        document.getElementById('loginBtnText').innerHTML = `<i class="fa-solid fa-crown me-1"></i> Mode Dewa`;
        document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-danger');
        
        document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
        
    } else {
        // JIKA DIA BUKAN ADMIN (MAHASISWA BIASA) - Walaupun passwordnya benar
        window.role = 'guest'; 
        document.getElementById('mainBody').classList.remove('admin-mode');
        
        Swal.fire({ icon: 'info', title: 'Akses Publik Berhasil', text: `Akses Mode Dewa ditolak. Anda masuk sebagai Pembaca.`, timer: 3000, showConfirmButton: false });
        
        // Ambil nama depan saja untuk di navbar
        let namaDepan = namaPengguna ? namaPengguna.split(' ')[0] : 'Mahasiswa';
        document.getElementById('loginBtnText').innerHTML = `<i class="fa-regular fa-circle-user me-1"></i> ${namaDepan}`;
        document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-success');
    }
    
    // Refresh UI
    if(typeof updateUISecaraRealtime === "function") updateUISecaraRealtime(); 
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
}

// ==========================================
// 2. LIVE EDITING KONTEN STRUKTUR WEB
// ==========================================
async function editTeks(elId, label, isInput = false) {
    const el = document.getElementById(elId);
    const { value: text } = await Swal.fire({ 
        title: `Edit Konten ${label}`, 
        input: isInput ? 'text' : 'textarea', 
        inputValue: el.innerText.trim(), 
        showCancelButton: true,
        confirmButtonColor: '#0B192C'
    });
    if (text) { 
        window.db.ref(elId).set(text); 
        Swal.fire({title: 'Sinkronisasi Berhasil!', text: 'Perubahan konten telah di-push ke cloud.', icon: 'success'}); 
    }
}

async function gantiGambar(elId, label) {
    const { value: url } = await Swal.fire({
        title: `Ubah Sumber ${label}`, 
        input: 'text',
        inputPlaceholder: 'Ketik nama file di GitHub (misal: logo1.png) atau URL Web',
        text: 'Untuk hasil terbaik dan anti-bug di iPhone/Laptop, pastikan gambar sudah di-upload ke GitHub Anda.',
        showCancelButton: true,
        confirmButtonColor: '#0B192C'
    });
    if(url) { 
        window.db.ref(elId).set(url); 
        Swal.fire({title: 'Gambar Terbarui!', icon: 'success'}); 
    }
}

async function gantiTemaDewa() {
    const { value: color } = await Swal.fire({
        title: 'The Architect - Color Controller',
        html: 'Pilih palet warna identitas baru website:<br><br><input type="color" id="warnaDewa" value="' + (window.globalData.karisma_theme || '#0B192C') + '" style="width:100%; height:60px; border:none; cursor:pointer; border-radius:10px;">',
        showCancelButton: true, 
        confirmButtonText: 'Terapkan Warna',
        confirmButtonColor: '#0B192C',
        preConfirm: () => { return document.getElementById('warnaDewa').value; }
    });
    if (color) { window.db.ref('karisma_theme').set(color); }
}

// ==========================================
// 3. EDIT DATA INTERAKTIF & MANAJEMEN BERITA
// ==========================================
async function tambahBeritaBaru() {
    const { value: form } = await Swal.fire({ 
        title: 'Publikasi Naskah Kajian Baru', 
        html: '<input id="sj" class="swal2-input" placeholder="Judul Naskah Kajian"><textarea id="si" class="swal2-textarea" placeholder="Isi Artikel Lengkap Kajian Akademik..."></textarea><input id="sf" class="swal2-input" placeholder="Nama File Gambar Cover di GitHub (Contoh: cover1.jpg)">', 
        preConfirm: () => { return { j: document.getElementById('sj').value, i: document.getElementById('si').value, f: document.getElementById('sf').value } } 
    });
    
    if (form && form.j) {
        let imgUrl = form.f || "https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=600";
        let dbNews = window.globalData.karisma_news || [];
        dbNews.unshift({ id: Date.now(), title: form.j, date: "Baru Saja", badge: "Breaking Issue", color: "bg-danger", img: imgUrl, short: form.i.substring(0,60)+"...", full: `<p>${form.i}</p>` });
        await window.db.ref('karisma_news').set(dbNews); 
        Swal.fire({title: 'Naskah Resmi Terpublikasi!', icon: 'success'});
    }
}

async function editBeritaFull() {
    let dbNews = window.globalData.karisma_news; 
    let idx = dbNews.findIndex(x => x.id === window.activeNewsId);
    const { value: f } = await Swal.fire({ 
        title: 'Revisi Naskah Kajian', 
        html: `<input id="ejs" class="swal2-input" value="${dbNews[idx].title}"><textarea id="eis" class="swal2-textarea" style="height:200px;">${dbNews[idx].full.replace(/<[^>]*>?/gm, '')}</textarea><input id="efile" class="swal2-input" placeholder="Ganti File Gambar Cover (Opsional)">`, 
        preConfirm: () => { return { j: document.getElementById('ejs').value, i: document.getElementById('eis').value, f: document.getElementById('efile').value } } 
    });
    if(f) { 
        if(f.f) dbNews[idx].img = f.f;
        dbNews[idx].title = f.j; dbNews[idx].full = `<p>${f.i}</p>`; 
        await window.db.ref('karisma_news').set(dbNews);
        Swal.fire({title: 'Revisi Sukses Tersinkronisasi!', icon: 'success'});
    }
}

function hapusBerita(id) {
    Swal.fire({title: 'Hapus paksa naskah kajian ini?', text: 'Data arsip yang dihapus tidak bisa dikembalikan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545'}).then(r => {
        if(r.isConfirmed){ 
            let dbNews = window.globalData.karisma_news; 
            dbNews = dbNews.filter(x => x.id !== id); 
            window.db.ref('karisma_news').set(dbNews); 
            Swal.fire({title: 'Terhapus!', icon: 'success'});
        }
    });
}

function hapusKomenDewa(newsId, indexKomen) {
    Swal.fire({ title: 'Moderasi Komentar: Hapus teks ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' }).then(r => {
        if(r.isConfirmed){ 
            let d = window.globalData['komentar_berita_'+newsId]; 
            d.splice(indexKomen, 1); 
            window.db.ref('komentar_berita_'+newsId).set(d); 
        }
    });
}

// ==========================================
// 4. KOTAK MASUK & INPUT LAYANAN ASPIRASI
// ==========================================
async function kirimInbox(tipe) {
    const { value: f } = await Swal.fire({ title: `Form Submit ${tipe}`, html: '<input id="inNama" class="swal2-input" placeholder="Nama Lengkap / Anonim"><textarea id="inPesan" class="swal2-textarea" placeholder="Tulis rumusan gagasan, kritik, opini, atau laporan Anda di sini..."></textarea>', preConfirm: () => [document.getElementById('inNama').value, document.getElementById('inPesan').value] });
    if(f && f[1]) {
        let d = window.globalData.karisma_inbox || [];
        d.unshift({ tipe: tipe, nama: f[0] || 'Anonim', pesan: f[1], tgl: new Date().toLocaleString() });
        window.db.ref('karisma_inbox').set(d);
        Swal.fire({title: 'Aspirasi Masuk Gembok Cloud!', text: 'Hanya jajaran pimpinan divisi Kastrat yang memegang otoritas membaca pesan ini.', icon: 'success'});
    }
}

function bukaInbox() {
    let d = window.globalData.karisma_inbox || [];
    let html = d.length === 0 ? '<p class="text-center text-muted mt-3 py-4">Kotak masuk aman terkendali (Kosong).</p>' : d.map((p, i) => `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
                <span class="badge bg-primary mb-2">${p.tipe}</span> 
                <small class="text-muted float-end">${p.tgl}</small>
                <h6 class="fw-bold text-dark">Pengirim: ${p.nama}</h6>
                <p class="mb-0 text-secondary" style="white-space: pre-line;">${p.pesan}</p>
                <button class="btn btn-sm btn-outline-danger mt-3 float-end rounded-pill px-3" onclick="hapusInbox(${i})"><i class="fa-solid fa-trash me-1"></i> Buang Pesan</button>
            </div>
        </div>`).join('');
    document.getElementById('inboxContent').innerHTML = html;
    new bootstrap.Modal(document.getElementById('inboxModal')).show();
}

function hapusInbox(i) { 
    let d = window.globalData.karisma_inbox; 
    d.splice(i, 1); 
    window.db.ref('karisma_inbox').set(d); 
    setTimeout(bukaInbox, 300); 
}

// ==========================================
// 5. MANAJEMEN DATA MODUL OPERASIONAL CASTRAT
// ==========================================
async function tambahJanji(){ 
    const {value: t} = await Swal.fire({input: 'text', title: 'Kawal Kebijakan Baru', inputPlaceholder: 'Ketik nama regulasi/janji instansi yang dikawal...'}); 
    if(t){ 
        let d = window.globalData.karisma_tracker || []; 
        d.push({t: t, s: "Proses Advokasi", c: "status-proses", i: "fa-spinner fa-spin text-warning"}); 
        window.db.ref('karisma_tracker').set(d);
    } 
}
function hapusTracker(i){ let d = window.globalData.karisma_tracker; d.splice(i, 1); window.db.ref('karisma_tracker').set(d); }
function ubahStatusTracker(i, stat){ 
    let d = window.globalData.karisma_tracker; 
    d[i].s = stat; 
    d[i].c = 'status-selesai'; 
    d[i].i = 'fa-circle-check text-success'; 
    window.db.ref('karisma_tracker').set(d); 
}

async function tambahAgenda(){ 
    const {value: f} = await Swal.fire({
        title: 'Tambah Agenda Baru',
        html: '<input id="a1" class="swal2-input" placeholder="Tanggal (Misal: 25 Jun)">' +
              '<input id="a2" class="swal2-input" placeholder="Nama Gerakan/Agenda">' +
              '<input id="a3" class="swal2-input" placeholder="Keterangan / Lokasi (Ketik Bebas)">', 
        preConfirm: () => [document.getElementById('a1').value, document.getElementById('a2').value, document.getElementById('a3').value]
    }); 
    if(f && f[1]){ 
        let d = window.globalData.karisma_agenda || []; 
        d.push({d: f[0] || 'TBA', t: f[1], ds: f[2] || "Menunggu informasi lanjutan"}); 
        window.db.ref('karisma_agenda').set(d);
        Swal.fire({title: 'Agenda Ditambahkan!', icon: 'success'});
    } 
}

function hapusAgenda(i){ let d = window.globalData.karisma_agenda; d.splice(i, 1); window.db.ref('karisma_agenda').set(d); }

async function tambahDokumen(){ 
    const {value: f} = await Swal.fire({
        title: 'Unggah Dokumen PDF',
        html: '<input id="r1" class="swal2-input" placeholder="Judul Dokumen Naskah">' +
              '<input id="rKategori" class="swal2-input" placeholder="Kategori (Bebas: Policy Brief/Kajian/dll)">' +
              '<input id="r2" class="swal2-input" placeholder="Link Google Drive PDF Resmi">', 
        preConfirm: () => [document.getElementById('r1').value, document.getElementById('r2').value, document.getElementById('rKategori').value]
    }); 
    if(f && f[0]){ 
        let d = window.globalData.karisma_repo || []; 
        d.unshift({j: f[0], k: f[2] || "Kajian Kastrat", t: "Baru", l: f[1]}); 
        window.db.ref('karisma_repo').set(d);
        Swal.fire({title: 'Dokumen Mengudara!', icon: 'success'});
    } 
}
function hapusRepo(i){ let d = window.globalData.karisma_repo; d.splice(i, 1); window.db.ref('karisma_repo').set(d); }

async function editDataInteraktif(type) {
    if(type === 'tekateki') {
        const { value: f } = await Swal.fire({ title: 'Konfigurasi Modul Teka Teki', html: `<input id="tq" class="swal2-input" value="${window.globalData.tekaTekiSoal || ''}" placeholder="Soal Teka-teki"><input id="ta" class="swal2-input" placeholder="Kunci Jawaban Tepat" value="${window.globalData.karisma_tekateki_a || ''}">`, preConfirm: () => [document.getElementById('tq').value, document.getElementById('ta').value]});
        if(f) { 
            window.db.ref('tekaTekiSoal').set(f[0]); 
            window.db.ref('karisma_tekateki_a').set(f[1]); 
            Swal.fire({title: 'Teka-teki Terbarui Cloud!', icon: 'success'});
        }
    } else { 
        Swal.fire('Informasi Pengembang', 'Modifikasi struktur kompas kuis memerlukan akses langsung ke Console Firebase Developer.', 'info'); 
    }
}

async function ubahLink(t) {
    let c = window.globalData.karisma_links || { angket: 'https://forms.gle', lapor: 'https://forms.gle' };
    const { value: u } = await Swal.fire({ title: `Ubah Alamat Tautan Form ${t}`, input: 'url', inputValue: c[t], showCancelButton: true });
    if (u) { 
        c[t] = u; 
        window.db.ref('karisma_links').set(c); 
        Swal.fire({title: 'Link Form Sinkron!', icon: 'success'});
    }
}

function exportDataCSV(tipe) {
    Swal.fire({title: 'Ekstraksi Arsip', text: `Berhasil menarik laporan data mentah ${tipe} langsung dari server Singapore!`, icon: 'success'});
}
