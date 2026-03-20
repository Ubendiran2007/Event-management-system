const { db } = require('./firebase');
const { collection, getDocs, query, where } = require('firebase/firestore');

async function checkEvent() {
    try {
        const q = query(collection(db, 'events'), where('title', '==', 'test'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log('No event found with title "test"');
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const { posterDataUrl, ...cleanData } = data;
            console.log('--- Event Data ---');
            console.log(JSON.stringify({ id: doc.id, ...cleanData }, null, 2));
        });
    } catch (e) {
        console.error(e);
    }
}

checkEvent();
