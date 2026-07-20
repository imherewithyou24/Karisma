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
    
    // Panggil render CMS Dashboard saat pertama kali dimuat jika statusnya Admin
    setTimeout(() => { 
        if((window.role === 'admin' || window.role === 'mod') && typeof renderCMSDashboard === 'function') {
            renderCMSDashboard(); 
        }
    }, 1500);
});

// ==========================================
// AUTO-SAVE DRAFT PENYELAMAT NYAWA
// ==========================================
setInterval(() => {
    let editorModal = document.getElementById('editorModal');
    if (editorModal && editorModal.classList.contains('show') && redaksiQuill && !editModeBeritaId) {
        let draft = {
            judul: document.getElementById('editJudul').value,
            isi: redaksiQuill.root.innerHTML
        };
        // Hanya simpan otomatis jika ada ketikan yang lumayan panjang dan bukan sedang edit berita lama
        if (draft.judul.length > 3 || draft.isi.length > 20) {
            localStorage.setItem('karisma_auto_draft', JSON.stringify(draft));
            let d = new Date();
            let draftEl = document.getElementById('draftStatus');
            if(draftEl) draftEl.innerHTML = `<i class="fa-solid fa-check-double text-success me-1"></i> Draft tersimpan otomatis (${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})`;
        }
    }
}, 10000); // Berjalan setiap 10 detik

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
            if(typeof renderCMSDashboard === 'function') renderCMSDashboard(); // Trigger CMS render
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
// 3. MANAJEMEN BERITA (CMS & RICH TEXT)
// ==========================================

function tambahBeritaBaru() {
    if(window.role !== 'admin' && window.role !== 'mod') return Swal.fire('Ditolak', 'Hanya Mode Dewa yang bisa mempublikasikan!', 'error');
    
    editModeBeritaId = null; 
    document.getElementById('editJudul').value = '';
    document.getElementById('editKategori').value = 'Kajian Akademik';
    document.getElementById('editPenulis').value = 'Ahmad Hafiz Arsya';
    document.getElementById('editDivisi').value = 'Kastrat';
    
    sampulWebPBase64 = "";
    if(document.getElementById('previewCoverContainer')) document.getElementById('previewCoverContainer').classList.add('d-none');
    if(document.getElementById('editCoverFile')) document.getElementById('editCoverFile').value = ''; 
    if(redaksiQuill) redaksiQuill.root.innerHTML = '';
    
    // Kembalikan tombol ke mode default (Buat Baru)
    let footerModal = document.querySelector('#editorModal .modal-footer');
    if(footerModal) {
        footerModal.innerHTML = `
            <div id="draftStatus" class="small text-muted fst-italic"><i class="fa-solid fa-cloud-arrow-up me-1"></i> Menunggu ketikan...</div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold px-4" onclick="simpanArtikel('Draft')"><i class="fa-solid fa-box-archive me-1"></i> Simpan Draft</button>
                <button type="button" class="btn btn-success rounded-pill fw-bold px-4" onclick="simpanArtikel('Publish')"><i class="fa-solid fa-paper-plane me-1"></i> Publikasikan</button>
            </div>
        `;
    }

    // Cek apakah ada draft yang belum dipublish
    let savedDraft = localStorage.getItem('karisma_auto_draft');
    if (savedDraft) {
        Swal.fire({
            title: 'Draft Ditemukan!',
            text: "Anda memiliki tulisan yang belum selesai. Lanjutkan yang sebelumnya?",
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Ya, Lanjutkan Draft',
            cancelButtonText: 'Hapus & Buat Naskah Baru',
            confirmButtonColor: '#0B192C'
        }).then((result) => {
            if (result.isConfirmed) {
                let parsed = JSON.parse(savedDraft);
                document.getElementById('editJudul').value = parsed.judul;
                if(redaksiQuill) redaksiQuill.root.innerHTML = parsed.isi;
                new bootstrap.Modal(document.getElementById('editorModal')).show();
            } else {
                localStorage.removeItem('karisma_auto_draft');
                new bootstrap.Modal(document.getElementById('editorModal')).show();
            }
        });
    } else {
        new bootstrap.Modal(document.getElementById('editorModal')).show();
    }
}

// BUKA EDIT CMS (MENGGANTIKAN FUNGSI LAMA)
window.bukaEditCMS = function(id) {
    let dbNewsRaw = window.globalData.karisma_news;
    let dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw || {});
    let n = dbNews.find(x => x && x.id === id);

    if(!n) return Swal.fire('Error', 'Data kajian tidak ditemukan!', 'error');

    editModeBeritaId = id; 

    // 1. Isi Metadata
    document.getElementById('editJudul').value = n.title || '';
    document.getElementById('editKategori').value = n.badge || 'Kajian Akademik';
    document.getElementById('editPenulis').value = n.penulis || 'Ahmad Hafiz Arsya';
    document.getElementById('editDivisi').value = n.divisi || 'Kastrat';

    // 2. Isi Thumbnail Lama
    sampulWebPBase64 = n.img || "";
    if(sampulWebPBase64) {
        if(document.getElementById('previewCoverImg')) document.getElementById('previewCoverImg').src = sampulWebPBase64;
        if(document.getElementById('previewCoverContainer')) document.getElementById('previewCoverContainer').classList.remove('d-none');
    } else {
        if(document.getElementById('previewCoverContainer')) document.getElementById('previewCoverContainer').classList.add('d-none');
    }

    // 3. Isi Rich Text Quill
    if(redaksiQuill) {
        redaksiQuill.root.innerHTML = n.full || '';
    }

    // 4. Ubah Fungsi Tombol Simpan
    let footerModal = document.querySelector('#editorModal .modal-footer');
    if(footerModal) {
        footerModal.innerHTML = `
            <div id="draftStatus" class="small text-muted fst-italic"><i class="fa-solid fa-pen-to-square me-1"></i> Mode Revisi Naskah</div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold px-4" onclick="simpanArtikel('Draft')"><i class="fa-solid fa-box-archive me-1"></i> Simpan Sbg Draft</button>
                <button type="button" class="btn btn-success rounded-pill fw-bold px-4" onclick="simpanArtikel('Publish')"><i class="fa-solid fa-paper-plane me-1"></i> Update & Publikasikan</button>
            </div>
        `;
    }

    // 5. Tampilkan Modal
    new bootstrap.Modal(document.getElementById('editorModal')).show();
};

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
            // BATASAN RESOLUSI DIHAPUS. BERAPAPUN UKURANNYA AKAN DIPROSES.
            
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

            // Standarisasi kanvas menjadi HD (1280x720) agar tetap ringan walau upload foto 4K
            // Namun jika foto asli lebih kecil dari HD, pertahankan ukurannya agar tidak pecah/pixelated ditarik paksa
            canvas.width = Math.min(1280, drawWidth); 
            canvas.height = canvas.width / targetRatio;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);

            sampulWebPBase64 = canvas.toDataURL('image/webp', 0.8);
            
            document.getElementById('previewCoverImg').src = sampulWebPBase64;
            document.getElementById('previewCoverContainer').classList.remove('d-none');
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

// MESIN SIMPAN ARTIKEL (BARU & REVISI)
window.simpanArtikel = function(targetStatus = 'Publish') {
    let judul = document.getElementById('editJudul').value.trim();
    let kategori = document.getElementById('editKategori').value;
    let penulis = document.getElementById('editPenulis').value.trim();
    let divisi = document.getElementById('editDivisi').value.trim();
    let isiHTML = redaksiQuill.root.innerHTML;
    
    if(!judul || !penulis || isiHTML === '<p><br></p>') {
        return Swal.fire('Lengkapi Data', 'Pastikan Judul, Penulis, dan Isi Naskah tidak kosong.', 'warning');
    }
    
    if(!sampulWebPBase64 && targetStatus === 'Publish') {
        return Swal.fire('Cover Wajib', 'Silakan upload thumbnail sebelum mempublikasikan.', 'warning');
    }

    let teksMurni = redaksiQuill.getText().trim();
    let ringkasan = teksMurni.substring(0, 150) + "...";
    
    let isRevisi = editModeBeritaId !== null;
    let pesanKonfirmasi = targetStatus === 'Publish' ? 
        (isRevisi ? "Naskah akan diperbarui dan kembali mengudara." : "Kajian ini akan disebarkan ke publik.") : 
        "Kajian akan disimpan secara privat sebagai Draft.";

    Swal.fire({
        title: targetStatus === 'Publish' ? (isRevisi ? 'Update Naskah?' : 'Publikasikan Sekarang?') : 'Simpan ke Draft?',
        text: pesanKonfirmasi,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: targetStatus === 'Publish' ? (isRevisi ? 'Update & Publish' : 'Ya, Publikasikan!') : 'Simpan Draft',
        confirmButtonColor: targetStatus === 'Publish' ? '#198754' : '#6c757d'
    }).then((result) => {
        if (result.isConfirmed) {
            let d = new Date();
            let dateString = `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'long' })} ${d.getFullYear()}`;
            let timeString = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;

            window.db.ref('karisma_news').once('value').then(snap => {
                let dbNewsRaw = snap.val();
                let dbNews = [];
                if(dbNewsRaw) {
                    dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw);
                    dbNews = dbNews.filter(n => n !== null && n !== undefined && n.id !== undefined);
                }
                
                if (isRevisi) {
                    let targetIndex = dbNews.findIndex(n => n.id === editModeBeritaId);
                    if (targetIndex !== -1) {
                        let oldData = dbNews[targetIndex];
                        dbNews[targetIndex] = {
                            ...oldData, 
                            title: judul, badge: kategori, penulis: penulis, divisi: divisi,
                            img: sampulWebPBase64 || oldData.img, short: ringkasan, full: isiHTML,
                            status: targetStatus,
                            last_edited: dateString + ' ' + timeString 
                        };
                    }
                } else {
                    let artikelBaru = {
                        id: Date.now(), title: judul, badge: kategori, penulis: penulis, divisi: divisi,
                        img: sampulWebPBase64 || '', short: ringkasan, full: isiHTML, 
                        date: dateString, time: timeString, status: targetStatus, last_edited: null
                    };
                    dbNews.unshift(artikelBaru);
                }
                
                window.db.ref('karisma_news').set(dbNews).then(() => {
                    localStorage.removeItem('karisma_auto_draft');
                    let modalEl = document.getElementById('editorModal');
                    if(modalEl) {
                        let modalIns = bootstrap.Modal.getInstance(modalEl);
                        if(modalIns) modalIns.hide();
                    }
                    
                    Swal.fire('Berhasil!', targetStatus === 'Publish' ? 'Kajian mengudara.' : 'Draft aman tersimpan.', 'success').then(() => {
                        if(typeof renderCMSDashboard === 'function') renderCMSDashboard();
                        if(typeof cariBerita === 'function') cariBerita(); 
                        if (isRevisi && typeof renderHalamanBacaPenuh === 'function' && targetStatus === 'Publish') {
                            renderHalamanBacaPenuh(editModeBeritaId); 
                        }
                    });
                });
            });
        }
    });
};

function hapusBerita(id) {
    Swal.fire({title: 'Hapus naskah ini?', text: 'Data arsip tidak bisa dikembalikan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545'}).then(r => {
        if(r.isConfirmed){ 
            window.db.ref('karisma_news').once('value').then(snap => {
                let dbNewsRaw = snap.val();
                let dbNews = Array.isArray(dbNewsRaw) ? dbNewsRaw : Object.values(dbNewsRaw);
                dbNews = dbNews.filter(x => x && x.id !== id); 
                window.db.ref('karisma_news').set(dbNews); 
                Swal.fire({title: 'Terhapus!', icon: 'success'});
                if(typeof renderCMSDashboard === 'function') renderCMSDashboard();
                if(typeof cariBerita === 'function') cariBerita();
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
// RENDERING CMS DASHBOARD
// ==========================================
function renderCMSDashboard() {
    let tbody = document.getElementById('cmsTableBody');
    if(!tbody) return;
    
    let dbNews = typeof getSafeNewsArray === 'function' ? getSafeNewsArray() : (window.globalData && window.globalData.karisma_news ? (Array.isArray(window.globalData.karisma_news) ? window.globalData.karisma_news : Object.values(window.globalData.karisma_news)).filter(n => n !== null && n !== undefined) : []);
    
    let filterStatusEl = document.getElementById('cmsFilterStatus');
    let filterStatus = filterStatusEl ? filterStatusEl.value : 'Semua';
    
    let filteredNews = dbNews.filter(n => {
        let status = n.status || 'Publish'; 
        if(filterStatus === 'Semua') return true;
        return status === filterStatus;
    });

    if (filteredNews.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Belum ada naskah kajian di dalam database.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredNews.map(n => {
        let status = n.status || 'Publish';
        let badgeColor = status === 'Publish' ? 'bg-success' : (status === 'Draft' ? 'bg-secondary' : 'bg-warning text-dark');
        let revisiText = n.last_edited ? `<br><small class="text-danger" style="font-size:10px;"><i class="fa-solid fa-pen-rotate me-1"></i>Direvisi: ${n.last_edited}</small>` : '';
        
        return `
        <tr>
            <td><span class="fw-bold text-dark-blue d-block" style="font-size:0.95rem; line-height:1.2;">${n.title}</span></td>
            <td><span class="badge bg-light text-dark border">${n.badge || '-'}</span></td>
            <td class="small fw-medium text-muted">${n.penulis || 'Kastrat'}</td>
            <td class="small text-muted">${n.date}${revisiText}</td>
            <td><span class="badge ${badgeColor}">${status}</span></td>
            <td class="text-center">
                <!-- PERUBAHAN: Memanggil window.bukaEditCMS -->
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm mb-1 mb-md-0" onclick="bukaEditCMS(${n.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline-danger rounded-circle shadow-sm" onclick="hapusBerita(${n.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
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
