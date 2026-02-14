let _io = null;

export const setIO = (io) => {
  _io = io;
};

export const getIO = () => {
  if (!_io) throw new Error('Socket.io not initialized. Call setIO(io) first.');
  return _io;
};
