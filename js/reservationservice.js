// /services/reservationService.js
import { db, appId } from '../js/firebase.js';
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const COLLECTION_PATH = `artifacts/${appId}/public/data/reservations`;

// 💡 التحسين الأهم (Optimization): نظام التخزين المؤقت (Cache)
// هذا المتغير سيحفظ الحجوزات في ذاكرة المتصفح لمنع تحميلها مراراً وتكراراً
let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // دقيقة واحدة (60,000 ملي ثانية)

/**
 * إرسال حجز جديد (يستخدم setDoc لمرة واحدة)
 */
export const submitNewReservation = async (reservationData) => {
    const docRef = doc(db, COLLECTION_PATH, reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    return reservationData.trackingCode;
};

/**
 * تتبع الحجز (يستخدم getDoc لمرة واحدة بدلاً من الاستماع لكل الحجوزات)
 */
export const getReservationByCode = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data();
    }
    return null; 
};

/**
 * جلب بيانات الإدارة (يستخدم getDocs مع Cache بدلاً من onSnapshot)
 */
export const getAdminReservations = async (forceRefresh = false) => {
    const now = Date.now();
    
    // إذا كانت البيانات موجودة في الذاكرة ولم تمر دقيقة، استخدمها مباشرة (توفير للقراءات 💸)
    if (!forceRefresh && cachedReservations && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedReservations;
    }

    // جلب البيانات من Firestore
    const q = query(collection(db, COLLECTION_PATH));
    const snapshot = await getDocs(q);
    
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    // ترتيب البيانات من الأحدث للأقدم
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // حفظ البيانات في الذاكرة المؤقتة
    cachedReservations = results;
    lastFetchTime = now;
    
    return results;
};

/**
 * تحديث حالة الحجز (مقبول، مرفوض، مؤرشف)
 */
export const updateReservationData = async (trackingCode, newData) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await updateDoc(docRef, newData);
    
    // تحديث الذاكرة المؤقتة محلياً لكي لا نحتاج لجلب البيانات من جديد بعد التعديل
    if (cachedReservations) {
        const index = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
        if (index > -1) {
            cachedReservations[index] = { ...cachedReservations[index], ...newData };
        }
    }
};

/**
 * الحذف النهائي للحجز
 */
export const deleteReservation = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await deleteDoc(docRef);
    
    // إزالة الحجز من الذاكرة المؤقتة محلياً
    if (cachedReservations) {
        cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
    }
};
