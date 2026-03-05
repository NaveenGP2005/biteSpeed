import request from 'supertest';
import express from 'express';
import identifyRoutes from './identify';
import contactService from '../services/contactService';

jest.mock('../services/contactService');

const app = express();
app.use(express.json());
app.use('/identify', identifyRoutes);

describe('Identify Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with contact data on valid request', async () => {
    const mockResponse = {
      primaryContactId: 1,
      emails: ['test@example.com'],
      phoneNumbers: ['1234567890'],
      secondaryContactIds: [],
    };

    (contactService.identify as jest.Mock).mockResolvedValueOnce(mockResponse);

    const response = await request(app)
      .post('/identify')
      .send({ email: 'test@example.com', phoneNumber: '1234567890' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ contact: mockResponse });
  });

  it('should return 400 when validation fails', async () => {
    const response = await request(app)
      .post('/identify')
      .send({ email: 'invalid-email' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 when neither email nor phone provided', async () => {
    const response = await request(app)
      .post('/identify')
      .send({});

    expect(response.status).toBe(400);
  });

  it('should handle service errors gracefully', async () => {
    (contactService.identify as jest.Mock).mockRejectedValueOnce(
      new Error('Database error')
    );

    const response = await request(app)
      .post('/identify')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
