import { SentencePipe } from './sentence.pipe';

describe('SentencePipe', () => {
  it('create an instance', () => {
    const pipe = new SentencePipe();
    expect(pipe).toBeTruthy();
  });
});
