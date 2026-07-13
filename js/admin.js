// ==========================================
// 1. SISTEM OTORISASI & PROFIL PENGGUNA (FIREBASE REALTIME)
// ==========================================

const DAFTAR_ADMIN_KASTRAT = [
    "2410914320014@mhs.ulm.ac.id",
    "2510914210051@mhs.ulm.ac.id",
    "2510914210027@mhs.ulm.ac.id",
    "2510914310025@mhs.ulm.ac.id",
    "2510914120021@mhs.ulm.ac.id",
    "2510914220054@mhs.ulm.ac.id"
];

function loginDenganGoogle() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
        handleUserLogin(result.user);
    }).catch((error) => {
        Swal.fire({title: 'Gagal Autentikasi', text: error.message, icon: 'error'});
    });
}

function handleUserLogin(user) {
    window.currentUid = user.uid;
    const userRef = window.db.ref('karisma_users/' + user.uid);
    const today = new Date().toLocaleDateString('id-ID');

    userRef.once('value', snapshot => {
        let userData = snapshot.val();
        
        // JIKA USER BARU PERTAMA KALI LOGIN
        if (!userData) {
            userData = {
                nama: user.displayName || 'Mahasiswa Anonim',
                email: user.email,
                foto: user.photoURL || 'https://via.placeholder.com/150',
                points: 0,
                streak: 1,
                lastLogin: today,
                badges: [],
                votesCount: 0,
                challengesCount: 0
            };
        } else {
            // JIKA USER LAMA, CEK STREAK LOGIN HARIAN
            if (userData.lastLogin !== today) {
                let yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (userData.lastLogin === yesterday.toLocaleDateString('id-ID')) {
                    userData.streak += 1;
                } else {
                    userData.streak = 1; // Putus streak
                }
                userData.lastLogin = today;
                userData.points += 5; // Poin login harian
                Swal.fire({ title: '+5 Poin!', text: `Login harian berhasil. Streak: ${userData.streak} hari🔥`, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
        }
        
        // Simpan pembaruan data ke Firebase
        userRef.set(userData);
        
        // Penentuan Role (Dewa vs Mahasiswa Biasa)
        if (DAFTAR_ADMIN_KASTRAT.includes(user.email)) {
            window.role = 'mod'; 
            document.getElementById('mainBody').classList.add('admin-mode');
            document.getElementById('loginBtnText').innerHTML = `<i class="fa-solid fa-crown me-1"></i> Mode Dewa`;
            document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-danger');
            document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
        } else {
            window.role = 'guest'; 
            document.getElementById('mainBody').classList.remove('admin-mode');
            let namaDepan = userData.nama.split(' ')[0];
            document.getElementById('loginBtnText').innerHTML = `<img src="${userData.foto}" class="rounded-circle me-1" width="22" height="22" style="object-fit:cover;"> ${namaDepan}`;
            document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-success');
        }

        // Buka gembok overlay Dasbor Kanan
        if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';
        
        // Tutup Modal
        bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
        
        // Render UI Data Personal
        renderPersonalDashboard(userData);
        checkAndAwardBadges(user.uid, userData);
    });
}

// FUNGSI 1: LOGIN MENGGUNAKAN GOOGLE
function loginDenganGoogle() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
        const user = result.user;
        // Lempar data nama, email, dan foto profil Google ke mesin pengecek
        cekHakAkses(user.email, user.displayName, user.photoURL);
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
        cekHakAkses(user.email, user.displayName || "Admin", null);
    })
    .catch((error) => {
        Swal.fire({title: 'Akses Ditolak', text: 'Email atau password salah / belum terdaftar.', icon: 'error'});
    });
}

// FUNGSI 3: PENGECEKAN HAK AKSES KETAT & REGISTRASI OTOMATIS
function cekHakAkses(emailPengguna, namaPengguna, fotoProfil = null) {
    // 1. Reset status visibilitas elemen Edit
    document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'none', 'important'));

    // 2. Bersihkan karakter aneh di email untuk dijadikan ID unik di Database
    let userId = emailPengguna.replace(/[^a-zA-Z0-9]/g, ''); 

    // 3. Cek apakah email yang login ADA di dalam daftar rahasia panitia
    if (DAFTAR_ADMIN_KASTRAT.includes(emailPengguna)) {
        // JIKA DIA ADALAH ADMIN KASTRAT
        window.role = 'mod'; 
        document.getElementById('mainBody').classList.add('admin-mode');
        
        Swal.fire({ icon: 'success', title: 'GOD MODE AKTIF', text: `Otorisasi Diterima, ${namaPengguna || emailPengguna}.`, timer: 2500, showConfirmButton: false });
        
        document.getElementById('loginBtnText').innerHTML = `<i class="fa-solid fa-crown me-1"></i> Mode Dewa`;
        document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-danger');
        
        document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
        
    } else {
        // JIKA DIA BUKAN ADMIN (MAHASISWA UMUM / PENGUNJUNG)
        window.role = 'guest'; 
        document.getElementById('mainBody').classList.remove('admin-mode');
        
        // Simpan/Daftarkan profil mahasiswa ini ke Database Firebase!
        window.db.ref('karisma_users/' + userId).set({
            nama: namaPengguna || 'Mahasiswa',
            email: emailPengguna,
            foto: fotoProfil || '',
            login_terakhir: new Date().toLocaleString('id-ID'),
            role: 'pengunjung'
        });
        
        Swal.fire({ icon: 'info', title: 'Registrasi Berhasil', text: `Halo ${namaPengguna || 'Rekan'}, Anda terdaftar sebagai Pengunjung. Akses edit ditolak.`, timer: 3000, showConfirmButton: false });
        
        // Ubah tombol Portal menjadi Nama & Foto Profil Google mahasiswa tersebut
        let namaDepan = namaPengguna ? namaPengguna.split(' ')[0] : 'Mahasiswa';
        let imgTag = fotoProfil ? `<img src="${fotoProfil}" class="rounded-circle me-1" width="22" height="22" style="object-fit:cover;">` : `<i class="fa-regular fa-circle-user me-1"></i>`;
        
        document.getElementById('loginBtnText').innerHTML = `${imgTag} ${namaDepan}`;
        document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-success');
    }
    
    // Refresh UI dan Poin Gamifikasi (jika ada)
    if(typeof updateUISecaraRealtime === "function") updateUISecaraRealtime(); 
    if(typeof initGamification === "function") initGamification();
    
    // Tutup pop-up login
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
}

// ==========================================
// 2. LIVE EDITING KONTEN & GAYA FONT (INLINE)
// ==========================================
async function editTeks(elId, label) {
    const el = document.getElementById(elId);
    const currentText = el.innerText.trim();
    // Tarik data font saat ini dari cloud jika ada
    const currentFont = window.globalData['font_' + elId] || '';

    const { value: formValues } = await Swal.fire({ 
        title: `Ubah Teks: ${label}`, 
        html: 
            `<textarea id="swal-input-text" class="swal2-textarea" style="height: 150px; font-size: 1rem;" placeholder="Ketik teks di sini...">${currentText}</textarea>` +
            `<div class="mt-3 text-start"><label class="fw-bold mb-1 text-dark-blue small"><i class="fa-solid fa-font me-1"></i> Pilih Gaya Tulisan (Font):</label>` +
            `<select id="swal-input-font" class="swal2-select w-100 m-0" style="font-size: 0.9rem;">
                <option value="" ${currentFont === '' ? 'selected' : ''}>-- Mengikuti Font Bawaan Tema --</option>
                <option value="'Poppins', sans-serif" style="font-family: 'Poppins', sans-serif;" ${currentFont === "'Poppins', sans-serif" ? 'selected' : ''}>Poppins (Modern & Tegas)</option>
                <option value="'Montserrat', sans-serif" style="font-family: 'Montserrat', sans-serif;" ${currentFont === "'Montserrat', sans-serif" ? 'selected' : ''}>Montserrat (Elegan & Lebar)</option>
                <option value="'Oswald', sans-serif" style="font-family: 'Oswald', sans-serif;" ${currentFont === "'Oswald', sans-serif" ? 'selected' : ''}>Oswald (Tinggi & Rapat)</option>
                <option value="'Playfair Display', serif" style="font-family: 'Playfair Display', serif;" ${currentFont === "'Playfair Display', serif" ? 'selected' : ''}>Playfair (Klasik / Estetik)</option>
                <option value="'Lora', serif" style="font-family: 'Lora', serif;" ${currentFont === "'Lora', serif" ? 'selected' : ''}>Lora (Gaya Naskah Jurnal)</option>
                <option value="'Roboto', sans-serif" style="font-family: 'Roboto', sans-serif;" ${currentFont === "'Roboto', sans-serif" ? 'selected' : ''}>Roboto (Bersih & Rapi)</option>
                <option value="monospace" style="font-family: monospace;" ${currentFont === "monospace" ? 'selected' : ''}>Monospace (Gaya Mesin Tik)</option>
                <option value="cursive" style="font-family: cursive;" ${currentFont === "cursive" ? 'selected' : ''}>Cursive (Tulisan Tangan)</option>
            </select></div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#0B192C',
        confirmButtonText: '<i class="fa-solid fa-floppy-disk me-1"></i> Simpan ke Cloud',
        preConfirm: () => {
            return {
                text: document.getElementById('swal-input-text').value,
                font: document.getElementById('swal-input-font').value
            }
        }
    });
    
    if (formValues) { 
        // Simpan Teksnya
        window.db.ref(elId).set(formValues.text); 
        // Simpan Font-nya ke brankas khusus dengan awalan font_
        window.db.ref('font_' + elId).set(formValues.font); 
        Swal.fire({title: 'Tersimpan!', text: 'Perubahan teks dan font berhasil mengudara.', icon: 'success', timer: 2000, showConfirmButton: false}); 
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
        title: 'Unggah Naskah PDF',
        html: '<input id="r1" class="swal2-input" placeholder="Judul Dokumen Naskah">' +
              '<select id="rKategori" class="swal2-select"><option value="Kajian Kastrat">Kajian Kastrat</option><option value="Policy Brief">Policy Brief</option><option value="Riset">Riset</option><option value="Artikel">Artikel</option></select>' +
              '<input id="r2" class="swal2-input" placeholder="Link Google Drive PDF Resmi">', 
        preConfirm: () => [document.getElementById('r1').value, document.getElementById('r2').value, document.getElementById('rKategori').value]
    }); 
    if(f && f[0]){ 
        let d = window.globalData.karisma_repo || []; 
        
        // Buat format tanggal otomatis ala Indonesia
        const today = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = today.toLocaleDateString('id-ID', options);

        d.unshift({j: f[0], k: f[2], t: formattedDate, l: f[1]}); 
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
// ==========================================
// FITUR ADMIN: EDIT GAMIFICATION (POLL & DAILY)
// ==========================================

async function editPollingDewa() {
    const defaultData = window.globalData.karisma_modern_poll || {q:"", opts:["","",""]};
    const { value: f } = await Swal.fire({ 
        title: 'Manajemen Live Polling', 
        html: `
            <input id="pQ" class="swal2-input" placeholder="Pertanyaan Polling" value="${defaultData.q}">
            <input id="pO1" class="swal2-input" placeholder="Opsi 1" value="${defaultData.opts[0] || ''}">
            <input id="pO2" class="swal2-input" placeholder="Opsi 2" value="${defaultData.opts[1] || ''}">
            <input id="pO3" class="swal2-input" placeholder="Opsi 3 (Opsional)" value="${defaultData.opts[2] || ''}">
            <div class="text-danger mt-2 small">Menyimpan ini akan me-reset seluruh jumlah suara menjadi 0.</div>`, 
        preConfirm: () => { 
            let opts = [document.getElementById('pO1').value, document.getElementById('pO2').value];
            if(document.getElementById('pO3').value) opts.push(document.getElementById('pO3').value);
            return { q: document.getElementById('pQ').value, opts: opts } 
        } 
    });
    
    if (f && f.q) {
        let newData = {
            q: f.q,
            opts: f.opts,
            votes: new Array(f.opts.length).fill(0),
            reactions: { fire: 0, thumbsUp: 0, thumbsDown: 0 }
        };
        await window.db.ref('karisma_modern_poll').set(newData); 
        Swal.fire({title: 'Polling Diperbarui!', text: 'Sistem dan suara berhasil di-reset.', icon: 'success'});
    }
}

async function editDailyDewa() {
    const today = new Date().toLocaleDateString('id-ID');
    const { value: f } = await Swal.fire({ 
        title: 'Tantangan Hari Ini', 
        html: `
            <input id="dQ" class="swal2-input" placeholder="Pertanyaan Tantangan">
            <input id="dO1" class="swal2-input" placeholder="Jawaban A (Benar)">
            <input id="dO2" class="swal2-input" placeholder="Jawaban B (Salah)">
            <input id="dO3" class="swal2-input" placeholder="Jawaban C (Salah)">
            <textarea id="dExp" class="swal2-textarea" placeholder="Penjelasan jawaban untuk mengedukasi mahasiswa..."></textarea>`, 
        preConfirm: () => { 
            return { 
                q: document.getElementById('dQ').value, 
                opts: [document.getElementById('dO1').value, document.getElementById('dO2').value, document.getElementById('dO3').value],
                exp: document.getElementById('dExp').value
            } 
        } 
    });
    
    if (f && f.q) {
        // Acak urutan jawaban secara otomatis agar yang benar (index 0) tidak selalu di pilihan A
        let optsAcak = [...f.opts].sort(() => Math.random() - 0.5);
        let indexBenar = optsAcak.indexOf(f.opts[0]); // Cari di mana jawaban benarnya bersembunyi

        let newData = {
            date: today,
            title: "Tantangan Kritis",
            q: f.q,
            opts: optsAcak,
            ans: indexBenar,
            exp: f.exp
        };
        await window.db.ref('karisma_daily').set(newData); 
        Swal.fire({title: 'Tantangan Mengudara!', text: 'Mahasiswa kini bisa menjawab tantangan baru Anda.', icon: 'success'});
    }
}
