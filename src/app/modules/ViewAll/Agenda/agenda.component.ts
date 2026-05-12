import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'agenda',
    templateUrl: './agenda.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet],
})
export class AgendaComponent {
    /**
     * Constructor
     */
    constructor() {}
}
