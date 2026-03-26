// Mock for ../server - prevents socket.io import issues in tests
export const io = {
    emit: jest.fn(),
};
