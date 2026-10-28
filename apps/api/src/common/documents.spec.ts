import { documentDigits, normalizeDocumentFields, DocumentNormalizationPipe } from './documents';
describe('document normalization at API boundaries', () => {
  it('preserves leading zeroes and strips pasted punctuation, spaces and unicode digits', () => {
    expect(documentDigits(' ０１２.３４５.６７８-９０ ')).toBe('01234567890');
    expect(documentDigits('12.345.678/0001-90')).toBe('12345678000190');
  });
  it('normalizes nested CRM/import fields without changing messages or secrets', () => {
    expect(normalizeDocumentFields({metadata:{document:'012.345.678-90'},items:[{cpfCnpj:'12.345.678/0001-90'}],content:'CPF 012.345.678-90',apiKey:'a-b'}))
      .toEqual({metadata:{document:'01234567890'},items:[{cpfCnpj:'12345678000190'}],content:'CPF 012.345.678-90',apiKey:'a-b'});
  });
  it('normalizes individual query parameters before lookup and leaves invalid lengths for validation', () => {
    const pipe=new DocumentNormalizationPipe();
    expect(pipe.transform('012.345.678-90',{type:'query',data:'document'})).toBe('01234567890');
    expect(pipe.transform('123-4',{type:'query',data:'document'})).toBe('1234');
  });
});
