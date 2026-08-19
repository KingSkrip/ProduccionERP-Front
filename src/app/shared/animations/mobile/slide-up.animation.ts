import { animate, style, transition, trigger } from '@angular/animations';

export const slideUp = trigger('slideUp', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate('320ms cubic-bezier(0.32, 0.72, 0, 1)', style({ transform: 'translateY(0)', opacity: 1 })),
  ]),
  transition(':leave', [
    animate('220ms cubic-bezier(0.4, 0, 1, 1)', style({ transform: 'translateY(120%)', opacity: 0 })),
  ]),
]);