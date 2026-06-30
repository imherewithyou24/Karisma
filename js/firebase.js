// 1. Konfigurasi Satelit Firebase Karisma V2 (Sesuai kode dari Firebase barumu)
const firebaseConfig = {
    apiKey: "AIzaSyAQKIbSfKi5G2tpA_Q_WSTjeAdWLz61PRY",
    authDomain: "karisma-psikologi-ulm.firebaseapp.com",
    databaseURL: "https://karisma-psikologi-ulm-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "karisma-psikologi-ulm",
    storageBucket: "karisma-psikologi-ulm.firebasestorage.app",
    messagingSenderId: "1079589739881",
    appId: "1:1079589739881:web:78e9699d4abc4e7441f1f8",
    measurementId: "G-00P7DP3RB5"
};

// 2. Menyalakan Mesin Firebase Koneksi
firebase.initializeApp(firebaseConfig);

// 3. Mendaftarkan Variabel ke Sistem Global (Window)
// Langkah ini wajib agar file app.js dan admin.js bisa langsung memakai fungsi database tanpa bentrok
window.db = firebase.database();
window.globalData = {}; 
window.role = 'guest';
window.activeNewsId = null;
