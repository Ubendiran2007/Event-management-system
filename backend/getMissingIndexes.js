const { collection, getDocs, query, where, orderBy, limit } = require('./firebaseClientWrapper');

async function checkQueries() {
  const urls = [];
  
  const testQuery = async (name, q) => {
    try {
      await getDocs(q);
      console.log(`[OK] ${name}`);
    } catch (err) {
      if (err.message && err.message.includes('https://console.firebase.google.com')) {
        const url = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)[0];
        console.log(`[MISSING INDEX] ${name}: ${url}`);
        urls.push(`- **${name}**: [Create Index](${url})`);
      } else {
        console.log(`[ERROR] ${name}:`, err.message);
      }
    }
  };

  // 1. Explore (status + date desc + __name__ asc)
  await testQuery('Explore (status, date, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'events'),
    where('status', 'in', ['POSTED']),
    orderBy('date', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));

  // 2. Events: Status Filter (status + createdAt desc + __name__ asc)
  await testQuery('Events by Status (status, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'events'),
    where('status', 'in', ['PENDING_HOD']),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));
  
  // 3. Events: Organizer Filter (organizerId + createdAt desc + __name__ asc)
  await testQuery('Events by Organizer (organizerId, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'events'),
    where('organizerId', '==', 'dummy'),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));
  
  // 4. Events: Organizer + Status (organizerId + status + createdAt desc + __name__ asc)
  await testQuery('Events by Organizer & Status (organizerId, status, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'events'),
    where('organizerId', '==', 'dummy'),
    where('status', 'in', ['PENDING_HOD']),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));

  // 5. OD Requests: Status (status + createdAt desc + __name__ asc)
  await testQuery('OD Requests by Status (status, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'odRequests'),
    where('status', 'in', ['PENDING_FACULTY']),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));

  // 6. OD Requests: Organizer + Status (organizerId + status + createdAt desc + __name__ asc)
  await testQuery('OD Requests by Organizer & Status (organizerId, status, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'odRequests'),
    where('organizerId', '==', 'dummy'),
    where('status', 'in', ['PENDING_FACULTY']),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));
  
  // 7. OD Requests: Class + Status (class + status + createdAt desc + __name__ asc)
  await testQuery('OD Requests by Class & Status (class, status, createdAt, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'odRequests'),
    where('class', '==', 'CSED'),
    where('status', 'in', ['PENDING_FACULTY']),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));

  // 8. Venues: Status (status + name asc + __name__ asc)
  await testQuery('Venues by Status (status, name, __name__)', query(
    collection(require('./firebaseClientWrapper').db, 'venues'),
    where('status', '==', 'ACTIVE'),
    orderBy('name', 'asc'),
    orderBy('__name__', 'asc'),
    limit(1)
  ));

  console.log('\n--- URLs ---\n');
  console.log(urls.join('\n'));
  
  process.exit(0);
}

checkQueries();
