import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchStudentODHistory } from '../services/odService';

export const useMyODs = (studentId) => {
  const { currentUser } = useAppContext();
  const [odRequests, setOdRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const idToFetch = studentId || currentUser?.id;
    if (!idToFetch) {
      setOdRequests(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    setLoading(true);
    let isMounted = true;

    fetchStudentODHistory(idToFetch).then(requests => {
      if (isMounted) {
        setOdRequests(requests);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [studentId, currentUser?.id]);

  return { odRequests, loading };
};
