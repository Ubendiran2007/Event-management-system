const getUserId = (req) => {
  const userId = req.query?.userId || req.body?.userId;
  if (!userId) throw new Error('userId is required');
  return userId;
};

module.exports = {
  getUserId
};
