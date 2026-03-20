const { db } = require('./firebase');
const { doc, updateDoc } = require('firebase/firestore');

async function fixEvent() {
    try {
        const eventRef = doc(db, 'events', 'C5E6NjeuaGp4X3f96TfG');
        await updateDoc(eventRef, {
            status: 'PENDING_IQAC',
            updatedAt: new Date().toISOString()
        });
        console.log('Event "test" advanced to PENDING_IQAC');
    } catch (e) {
        console.error(e);
    }
}

fixEvent();
