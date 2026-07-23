import { useState, useEffect } from 'react';
import { fetchAnalyticsODs } from '../services/odService';

export const useAnalyticsOD = (filters = {}) => {
  const [odRequests, setOdRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create a stable string representation of filters for useEffect dependency
  const filtersString = JSON.stringify(filters);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchAnalyticsODs(filters).then(requests => {
      if (isMounted) {
        setOdRequests(requests);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [filtersString]);

  return { odRequests, loading };
};
