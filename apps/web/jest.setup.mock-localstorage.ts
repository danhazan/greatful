const mockAccessToken = 'mock-token';
jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key: string) {
  if (key === 'access_token') return mockAccessToken;
  return null;
});
