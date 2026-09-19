import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { sanitizeInput, sanitizeHtml } from '../src/middleware/validation.middleware';

describe('Input and HTML Sanitization (Issue #13)', () => {
  describe('sanitizeHtml utility', () => {
    it('should strip script tags and escape HTML characters', () => {
      const dirty = '<script>alert("xss")</script>Hello <b>World</b>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('</script>');
      expect(clean).toContain('&lt;b&gt;World&lt;/b&gt;');
    });

    it('should strip inline event handlers', () => {
      const dirty = '<img src="x" onerror="alert(1)">Image';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onerror');
    });

    it('should strip javascript: pseudo-protocol', () => {
      const dirty = '<a href="javascript:alert(1)">Click</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should remove null bytes and trim whitespace', () => {
      const dirty = '  test\0with\0null   ';
      const clean = sanitizeHtml(dirty);
      expect(clean).toBe('testwithnull');
    });
  });

  describe('sanitizeInput middleware integration', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(sanitizeInput);

      app.post('/test/sanitize', (req: Request, res: Response) => {
        res.status(200).json({ data: req.body });
      });
    });

    it('should sanitize nested request body objects and arrays', async () => {
      const payload = {
        title: '<script>evil()</script>Bounty Title',
        description: 'Normal text with <img src=x onerror=alert(1)> and tags',
        tags: ['<script>tag1</script>', 'clean-tag'],
        metadata: {
          note: '<iframe src="evil.com"></iframe>Note content',
        },
      };

      const res = await request(app)
        .post('/test/sanitize')
        .send(payload)
        .expect(200);

      const data = res.body.data;
      expect(data.title).toBe('&lt;Bounty Title');
      expect(data.description).not.toContain('onerror');
      expect(data.description).toContain('&lt;img');
      expect(data.tags[0]).toBe('&lt;tag1');
      expect(data.tags[1]).toBe('clean-tag');
      expect(data.metadata.note).not.toContain('<iframe');
    });
  });
});
