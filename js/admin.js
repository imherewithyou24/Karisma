// ==========================================
// INISIALISASI MESIN STUDIO REDAKSI (QUILL.JS)
// ==========================================
let redaksiQuill;
let sampulWebPBase64 = ""; // Tempat menyimpan gambar yang sudah di-crop
let editModeBeritaId = null; // Penanda apakah sedang buat baru atau revisi

document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('quillEditor')) {
        redaksiQuill = new Quill('#quillEditor', {
            theme: 'snow',
            placeholder: 'Mulai ketik naskah kajian di sini...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'align': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'blockquote'],
                    ['clean']
                ]
            }
        });
    }
});

// ==========================================
// 1. SISTEM OTORISASI & PROFIL PENGGUNA
// ==========================================

const DAFTAR_ADMIN_KASTRAT = [
    "2410914320014@mhs.ulm.ac.id",
    "2510914210051@mhs.ulm.ac.id",
    "2510914210027@mhs.ulm.ac.id",
    "2510914310025@mhs.ulm.ac.id",
    "2510914120021@mhs.ulm.ac.id",
    "2510914220054@mhs.ulm.ac.id"
];

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

firebase.auth().getRedirectResult().then((result) => {
    if (result && result.user) {
        handleUserLogin(result.user, true);
    }
}).catch((error) => {
    console.error("Error dari Redirect iOS:", error);
});

firebase.auth().onAuthStateChanged((user) => {
    if (user) { handleUserLogin(user, false); }
});

function loginDenganGoogle() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    if (isIOS) {
        Swal.fire({
            title: 'Membuka Portal...',
            text: 'Mengarahkan dengan aman khusus perangkat Apple...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        firebase.auth().signInWithRedirect(googleProvider);
    } else {
        firebase.auth().signInWithPopup(googleProvider)
        .then((result) => {
            handleUserLogin(result.user, true);
        }).catch((error) => {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                Swal.fire({
                    title: 'Akses Dicekal',
                    text: 'Browser Anda memblokir jendela Login Google. Silakan matikan pemblokir pop-up.',
                    icon: 'warning',
                    confirmButtonColor: '#0B192C'
                });
            } else {
                Swal.fire({title: 'Gagal Autentikasi', text: error.message, icon: 'error'});
            }
        });
    }
}

function loginDenganEmail() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    
    if (email.trim() === '' || pass.trim() === '') { return Swal.fire('Oops...', 'Email dan Password tidak boleh kosong!', 'error'); }

    firebase.auth().signInWithEmailAndPassword(email, pass)
    .then((userCredential) => { handleUserLogin(userCredential.user, true); })
    .catch((error) => { Swal.fire({title: 'Akses Ditolak', text: 'Email atau password salah / belum terdaftar.', icon: 'error'}); });
}

function handleUserLogin(user, isBaruLoginManual = false) {
    window.currentUid = user.uid;
    const userRef = window.db.ref('karisma_users/' + user.uid);
    const today = new Date().toLocaleDateString('id-ID');

    userRef.once('value').then(snapshot => {
        let userData = snapshot.val();
        
        if (!userData) {
            userData = {
                nama: user.displayName || user.email.split('@')[0] || 'Mahasiswa', email: user.email,
                foto: user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'M') + '&background=0B192C&color=FFC107',
                points: 0, streak: 1, lastLogin: today, badges: [], votesCount: 0, challengesCount: 0
            };
        } else {
            if (userData.lastLogin !== today) {
                let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                if (userData.lastLogin === yesterday.toLocaleDateString('id-ID')) { userData.streak += 1; } 
                else { userData.streak = 1; }
                userData.lastLogin = today; userData.points += 5;
                if(isBaruLoginManual) { Swal.fire({ title: '+5 Poin!', text: `Login harian berhasil. Streak: ${userData.streak} hari🔥`, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }); }
            }
            if(!userData.foto) userData.foto = user.photoURL || 'https://ui-avatars.com/api/?name=' + userData.nama + '&background=0B192C&color=FFC107';
        }
        
        userRef.set(userData);
        
        if (DAFTAR_ADMIN_KASTRAT.includes(user.email)) {
            window.role = 'mod'; document.getElementById('mainBody').classList.add('admin-mode');
            document.getElementById('loginBtnText').innerHTML = `<i class="fa-solid fa-crown me-1"></i> Mode Dewa`;
            document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-danger');
            document.querySelectorAll('.admin-only, .mod-only').forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
        } else {
            window.role = 'guest'; document.getElementById('mainBody').classList.remove('admin-mode');
            let namaDepan = userData.nama.split(' ')[0];
            document.getElementById('loginBtnText').innerHTML = `<img src="${userData.foto}" class="rounded-circle me-1" width="22" height="22" style="object-fit:cover;"> ${namaDepan}`;
            document.getElementById('loginBtnText').classList.replace('btn-outline-primary', 'btn-success');
        }

        let overlay = document.getElementById('authOverlay');
        if(overlay) { overlay.classList.remove('d-flex'); overlay.classList.add('d-none'); }
        
        const loginModalEl = document.getElementById('loginModal');
        if(loginModalEl) { let modal = bootstrap.Modal.getInstance(loginModalEl); if(modal) modal.hide(); }
        
        if(typeof renderPersonalDashboard === "function") renderPersonalDashboard(userData);
        if(typeof checkAndAwardBadges === "function") checkAndAwardBadges(user.uid, userData);
    });
}


// ==========================================
// 2. LIVE EDITING KONTEN & GAYA FONT (INLINE)
// ==========================================
async function editTeks(elId, label) {
    const el = document.getElementById(elId);
    const currentText = el.innerText.trim();
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
            return { text: document.getElementById('swal-input-text').value, font: document.getElementById('swal-input-font').value }
        }
    });
    
    if (formValues) { 
        window.db.ref(elId).set(formValues.text); 
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
    if(url) { window.db.ref(elId).set(url); Swal.fire({title: 'Gambar Terbarui!', icon: 'success'}); }
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
// 3. EDIT DATA INTERAKTIF & MANAJEMEN BERITA (HEADLESS CMS)
// ==========================================

// Fungsi Buka Studio Redaksi Baru
function tambahBeritaBaru() {
    if(window.role !== 'admin' && window.role !== 'mod') return Swal.fire('Ditolak', 'Hanya Mode Dewa yang bisa mempublikasikan!', 'error');
    
    editModeBeritaId = null; // Mode Bikin Naskah Baru
    
    document.getElementById('editJudul').value = '';
    document.getElementById('editKategori').value = 'Kajian Akademik';
    document.getElementById('editPenulis').value = 'Ahmad Hafiz Arsya';
    document.getElementById('editDivisi').value = 'Kastrat';
    
    sampulWebPBase64 = "";
    document.getElementById('previewCoverContainer').classList.add('d-none');
    document.getElementById('editCoverFile').value = ''; 
    
    if(redaksiQuill) redaksiQuill.root.innerHTML = '';
    
    new bootstrap.Modal(document.getElementById('editorModal')).show();
}

// Fungsi Edit Berita Lama pakai Studio Redaksi
function editBeritaFull() {
    if(window.role !== 'admin' && window.role !== 'mod') return Swal.fire('Ditolak', 'Hanya Mode Dewa!', 'error');
    
    let id = window.activeNewsId;
    if(!id) return;
    
    // Ambil data Array yang kebal bug
    let dbNewsRaw = window.globalData.karisma_news;
    let dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw);
    let artikel = dbNews.find(x => x && x.id === id);
    if(!artikel) return;

    editModeBeritaId = id; // Mode Revisi Naskah
    
    document.getElementById('editJudul').value = artikel.title || '';
    document.getElementById('editKategori').value = artikel.badge || 'Kajian Akademik';
    document.getElementById('editPenulis').value = artikel.penulis || 'Ahmad Hafiz Arsya';
    document.getElementById('editDivisi').value = artikel.divisi || 'Kastrat';
    
    sampulWebPBase64 = artikel.img || "";
    if(sampulWebPBase64) {
        document.getElementById('previewCoverImg').src = sampulWebPBase64;
        document.getElementById('previewCoverContainer').classList.remove('d-none');
    } else {
        document.getElementById('previewCoverContainer').classList.add('d-none');
    }
    
    if(redaksiQuill) redaksiQuill.root.innerHTML = artikel.full || '';
    
    new bootstrap.Modal(document.getElementById('editorModal')).show();
}

// Mesin Pengolah Gambar HTML5 (Crop Otomatis & Konversi WebP)
function prosesGambarUpload(event) {
    const file = event.target.files[0];
    if(!file) return;

    if(!file.type.match('image.*')) {
        return Swal.fire('Gagal', 'Mohon pilih file gambar (JPG/PNG).', 'error');
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Filter Resolusi
            if(img.width < 1600 || img.height < 900) {
                Swal.fire({
                    title: 'Resolusi Terlalu Kecil!',
                    html: `Gambar ini berukuran <b>${img.width}x${img.height}px</b>.<br>Minimal yang diizinkan adalah <b>1600x900px</b> agar tajam di HP.`,
                    icon: 'warning',
                    confirmButtonColor: '#0B192C'
                });
                return; 
            }

            // Mesin Pemotong Presisi 16:9
            const canvas = document.createElement('canvas');
            const targetRatio = 16 / 9;
            const imgRatio = img.width / img.height;
            
            let drawWidth = img.width;
            let drawHeight = img.height;
            let offsetX = 0;
            let offsetY = 0;

            if (imgRatio > targetRatio) {
                drawWidth = img.height * targetRatio;
                offsetX = (img.width - drawWidth) / 2;
            } else {
                drawHeight = img.width / targetRatio;
                offsetY = (img.height - drawHeight) / 2;
            }

            canvas.width = 1280; // Standar optimal Web Modern
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);

            // Simpan sebagai WebP super ringan (Kualitas 80%)
            sampulWebPBase64 = canvas.toDataURL('image/webp', 0.8);
            
            document.getElementById('previewCoverImg').src = sampulWebPBase64;
            document.getElementById('previewCoverContainer').classList.remove('d-none');
            
            Swal.fire({title: 'Gambar Siap!', text: 'Berhasil dipotong ke 16:9 dan dioptimasi ke WebP.', icon: 'success', timer: 1500, showConfirmButton: false});
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function previewArtikel() {
    let judul = document.getElementById('editJudul').value;
    let isiHTML = redaksiQuill.root.innerHTML;
    
    if(!judul || isiHTML === '<p><br></p>') return Swal.fire('Kosong', 'Judul dan isi artikel harus diisi!', 'warning');
    
    Swal.fire({
        title: 'Preview Naskah',
        html: `<div style="text-align:left; max-height: 60vh; overflow-y:auto; line-height: 1.8;">
                <h3 style="font-weight:bold; color:#0B192C; margin-bottom:15px;">${judul}</h3>
                ${sampulWebPBase64 ? `<img src="${sampulWebPBase64}" style="width:100%; border-radius:10px; margin-bottom:20px;">` : ''}
                <div style="font-size: 1.1rem;">${isiHTML}</div>
               </div>`,
        width: '800px',
        confirmButtonText: 'Tutup Preview',
        confirmButtonColor: '#0B192C'
    });
}

function simpanArtikel() {
    let judul = document.getElementById('editJudul').value.trim();
    let kategori = document.getElementById('editKategori').value;
    let penulis = document.getElementById('editPenulis').value.trim();
    let divisi = document.getElementById('editDivisi').value.trim();
    let isiHTML = redaksiQuill.root.innerHTML;
    
    if(!judul || !penulis || isiHTML === '<p><br></p>') {
        return Swal.fire('Lengkapi Data', 'Pastikan Judul, Penulis, dan Isi Naskah tidak kosong.', 'warning');
    }
    
    if(!sampulWebPBase64) {
        return Swal.fire('Cover Wajib', 'Silakan upload gambar resolusi tinggi terlebih dahulu.', 'warning');
    }

    let teksMurni = redaksiQuill.getText().trim();
    let ringkasan = teksMurni.substring(0, 150) + "...";

    Swal.fire({
        title: editModeBeritaId ? 'Simpan Perubahan?' : 'Publikasikan Sekarang?',
        text: editModeBeritaId ? "Naskah yang direvisi akan segera tayang." : "Kajian ini akan disebarkan ke publik.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: editModeBeritaId ? 'Ya, Simpan!' : 'Ya, Publikasikan!',
        confirmButtonColor: '#198754'
    }).then((result) => {
        if (result.isConfirmed) {
            window.db.ref('karisma_news').once('value').then(snap => {
                let dbNewsRaw = snap.val();
                let dbNews = [];
                if(dbNewsRaw) {
                    dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw);
                    dbNews = dbNews.filter(n => n !== null && n !== undefined && n.id !== undefined);
                }
                
                if (editModeBeritaId) {
                    let idx = dbNews.findIndex(x => x.id === editModeBeritaId);
                    if(idx > -1) {
                        dbNews[idx].title = judul;
                        dbNews[idx].badge = kategori;
                        dbNews[idx].penulis = penulis;
                        dbNews[idx].divisi = divisi;
                        dbNews[idx].img = sampulWebPBase64;
                        dbNews[idx].short = ringkasan;
                        dbNews[idx].full = isiHTML;
                        
                        let d = new Date();
                        dbNews[idx].date = `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'long' })} ${d.getFullYear()} (Revisi)`;
                    }
                } else {
                    let newId = Date.now();
                    let d = new Date();
                    let dateString = `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'long' })} ${d.getFullYear()}`;
                    let timeString = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;

                    let artikelBaru = {
                        id: newId, title: judul, badge: kategori, penulis: penulis, divisi: divisi,
                        img: sampulWebPBase64, short: ringkasan, full: isiHTML, date: dateString, time: timeString
                    };
                    dbNews.unshift(artikelBaru); 
                }
                
                window.db.ref('karisma_news').set(dbNews).then(() => {
                    let modalEl = document.getElementById('editorModal');
                    let modalIns = bootstrap.Modal.getInstance(modalEl);
                    if(modalIns) modalIns.hide();
                    
                    Swal.fire('Berhasil!', editModeBeritaId ? 'Revisi sukses tersinkronisasi.' : 'Kajian resmi mengudara.', 'success').then(() => {
                        if (editModeBeritaId && typeof renderHalamanBacaPenuh === 'function') {
                            renderHalamanBacaPenuh(editModeBeritaId); 
                        }
                    });
                });
            });
        }
    });
}

function hapusBerita(id) {
    Swal.fire({title: 'Hapus paksa naskah kajian ini?', text: 'Data arsip yang dihapus tidak bisa dikembalikan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545'}).then(r => {
        if(r.isConfirmed){ 
            window.db.ref('karisma_news').once('value').then(snap => {
                let dbNewsRaw = snap.val();
                let dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw);
                dbNews = dbNews.filter(x => x && x.id !== id); 
                window.db.ref('karisma_news').set(dbNews); 
                Swal.fire({title: 'Terhapus!', icon: 'success'});
            });
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
        let optsAcak = [...f.opts].sort(() => Math.random() - 0.5);
        let indexBenar = optsAcak.indexOf(f.opts[0]); 

        let newData = {
            date: today, title: "Tantangan Kritis", q: f.q, opts: optsAcak, ans: indexBenar, exp: f.exp
        };
        await window.db.ref('karisma_daily').set(newData); 
        Swal.fire({title: 'Tantangan Mengudara!', text: 'Mahasiswa kini bisa menjawab tantangan baru Anda.', icon: 'success'});
    }
}
