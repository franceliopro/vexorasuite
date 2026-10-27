import { participantPhoto, socialUsername } from './social-identity';
it('shows an Instagram handle instead of turning a display name into a handle',()=>{
 expect(socialUsername({platform:'instagram',name:'Francelio Alves da Silva',profileName:'Francelio Alves da Silva'})).toBeUndefined();
 expect(socialUsername({platform:'instagram',profileUrl:'https://www.instagram.com/franceliopro/'})).toBe('franceliopro');
 expect(socialUsername({platform:'instagram',username:'@franceliopro'})).toBe('franceliopro');
});
it('never substitutes the business or another participant photo',()=>{
 expect(participantPhoto({picture:'business',participants:[{id:'other',avatarUrl:'other'}]},'customer')).toBeUndefined();
 expect(participantPhoto({participants:[{id:'customer',profilePictureUrl:'customer'}]},'customer')).toBe('customer');
});
