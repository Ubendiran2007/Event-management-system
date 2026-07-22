require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function fixSections() {
    try {
        console.log('Starting section fix migration...');
        const batchDocsRefs = await db.collection('students').listDocuments();
        let totalMoved = 0;

        for (const batchRef of batchDocsRefs) {
            const batchId = batchRef.id;
            console.log(`Checking batch: ${batchId}`);
            
            // Get all subcollections (departments) for this batch
            const collections = await batchRef.listCollections();
            
            for (const deptCollection of collections) {
                const deptId = deptCollection.id;
                console.log(`  Checking department: ${deptId}`);
                
                const sectionsSnapshot = await deptCollection.get();
                for (const sectionDoc of sectionsSnapshot.docs) {
                    const sectionId = sectionDoc.id;
                    const docData = sectionDoc.data();
                    
                    let parsedSec = sectionId;
                    // If section is equal to class name (e.g. "CSE D"), extract just the section letter
                    if (parsedSec.toUpperCase().startsWith(deptId.toUpperCase() + ' ') || parsedSec.toUpperCase().startsWith(deptId.toUpperCase() + '-')) {
                        parsedSec = parsedSec.substring(deptId.length + 1).trim();
                    } else if (parsedSec.toUpperCase() === deptId.toUpperCase()) {
                        // This shouldn't happen usually but just in case
                        parsedSec = ''; 
                    }
                    
                    if (parsedSec && parsedSec !== sectionId) {
                        console.log(`    Found invalid section format: '${sectionId}'. Should be '${parsedSec}'`);
                        
                        // We need to move this document to the new sectionId
                        const newRef = deptCollection.doc(parsedSec);
                        const newSnap = await newRef.get();
                        
                        let updatedStudents = (docData.students || []).map(student => {
                            let sSec = student.section || '';
                            if (sSec.toUpperCase().startsWith(deptId.toUpperCase() + ' ') || sSec.toUpperCase().startsWith(deptId.toUpperCase() + '-')) {
                                sSec = sSec.substring(deptId.length + 1).trim();
                            }
                            student.section = sSec;
                            return student;
                        });
                        
                        if (newSnap.exists) {
                            console.log(`      Merging with existing document '${parsedSec}'...`);
                            const existingData = newSnap.data();
                            const existingStudents = existingData.students || [];
                            
                            // Prevent duplicates during merge
                            const existingIds = new Set(existingStudents.map(s => s.id));
                            const mergedStudents = [...existingStudents];
                            updatedStudents.forEach(s => {
                                if (!existingIds.has(s.id)) {
                                    mergedStudents.push(s);
                                }
                            });
                            
                            await newRef.update({
                                students: mergedStudents
                            });
                        } else {
                            console.log(`      Creating new document '${parsedSec}'...`);
                            await newRef.set({
                                batch: docData.batch || batchId,
                                department: docData.department || deptId,
                                section: parsedSec,
                                students: updatedStudents
                            });
                        }
                        
                        console.log(`      Deleting old document '${sectionId}'...`);
                        await sectionDoc.ref.delete();
                        totalMoved += updatedStudents.length;
                    } else {
                        // Even if the document name is fine, let's make sure the inner student properties are fine
                        let needsUpdate = false;
                        let updatedStudents = (docData.students || []).map(student => {
                            let sSec = student.section || '';
                            if (sSec.toUpperCase().startsWith(deptId.toUpperCase() + ' ') || sSec.toUpperCase().startsWith(deptId.toUpperCase() + '-')) {
                                sSec = sSec.substring(deptId.length + 1).trim();
                                needsUpdate = true;
                                student.section = sSec;
                            }
                            return student;
                        });
                        
                        if (needsUpdate) {
                            console.log(`    Fixing inner student sections in valid document '${sectionId}'...`);
                            await sectionDoc.ref.update({
                                students: updatedStudents
                            });
                        }
                    }
                }
            }
        }
        console.log(`Migration completed! Fixed sections for ${totalMoved} students.`);
    } catch (err) {
        console.error('Error during migration:', err);
    }
}

fixSections();
