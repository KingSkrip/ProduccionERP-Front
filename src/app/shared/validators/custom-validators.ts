import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {

    /** CURP: solo letras, máximo 10 caracteres y conversión automática a mayúsculas */
    static curpSimple(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;

            let value = control.value.toUpperCase();

            // Solo letras A-Z
             value = value.replace(/[^A-Z0-9]/g, '');

            // Limitar a 10 caracteres
            value = value.substring(0, 18);

            // Si cambia, se actualiza el control
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }

            // Validación final
            if (value.length > 0 && value.length < 10) {
                return { curpIncomplete: true };
            }

            return null;
        };
    }


    /** Teléfono: solo 10 dígitos */
    static telefono(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value.replace(/\D/g, '');
            value = value.substring(0, 10);
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            if (value.length > 0 && value.length < 10) {
                return { telefonoIncomplete: true };
            }
            return null;
        };
    }

    /** Email: limpieza + validación basica */
    static emailClean(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value.trim().toLowerCase();
            value = value.replace(/\s+/g, '');
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            return regex.test(value) ? null : { emailInvalid: true };
        };
    }

    /** Nombre: solo letras y espacios. 
     * Convierte cada palabra a Capital Letter automáticamente.
     */
    static nombreCapitalizado(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
            value = value.replace(/\s+/g, ' ');
            value = value.trimStart();
            value = value
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');

            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }

            return null;
        };
    }

    /** Texto normal: solo letras y espacios. Capitaliza cada palabra. */
    static soloTextoCapitalizado(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
            value = value.replace(/\s+/g, ' ');
            value = value.trimStart();
            value = value
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            return null;
        };
    }

    /** Código postal: solo 5 dígitos */
    static cp(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value.replace(/\D/g, '');
            value = value.substring(0, 5);
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            return value.length === 5 ? null : { cpIncompleto: true };
        };
    }

    /** Limpieza básica: Quita espacios dobles y caracteres raros */
    static limpiarBasico(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.replace(/\s+/g, ' ');
            value = value.replace(/[^\w\s\-#]/g, '');
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            return null;
        };
    }

    static puestoSimple(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
            value = value.replace(/\s+/g, ' ');
            value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }

            return null;
        };
    }

    static fechaDDMMYYYY(): ValidatorFn {
     return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;

        // Si está vacío → deja que required lo maneje
        if (!value) {
            return null;
        }

        // Si no es un objeto Date válido
        if (!(value instanceof Date) || isNaN(value.getTime())) {
            return { fechaInvalida: true };
        }

        // Opcional: restringir fechas futuras (ej. fecha de alta no puede ser futura)
        // Descomenta si lo necesitas:
        // const hoy = new Date();
        // hoy.setHours(0, 0, 0, 0);
        // if (value > hoy) {
        //     return { fechaFutura: true };
        // }

        // Opcional: restringir año mínimo (ej. no antes de 1900 o 1950)
        const año = value.getFullYear();
        if (año < 1800 || año > 2100) {
            return { fechaInvalida: true };
        }

        // Todo bien
        return null;
    };
}

    static comentarioSimple(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.charAt(0).toUpperCase() + value.slice(1);
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            return null;
        };
    }

    static rfcSimple(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value.toUpperCase();
            value = value.replace(/[^A-Z0-9Ñ&]/g, '');
            value = value.substring(0, 13);
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }
            const regex = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{0,3})$/;
            return regex.test(value) ? null : { rfcInvalido: true };
        };
    }

    static regimenFiscalSimple(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            let value = control.value;
            value = value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '');
            value = value.replace(/\s+/g, ' ');
            value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            if (value !== control.value) {
                control.patchValue(value, { emitEvent: false });
            }

            return null;
        };
    }

    /** Seguridad Social: permite cualquier valor alfanumérico o vacío (sin validar IMSS) */
static noIMSS(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) return null; // vacío permitido

        let value = control.value.toUpperCase(); // opcional, mayúsculas
        // Solo letras, números y guion
        value = value.replace(/[^A-Z0-9\-]/g, '');
        // Limitar a 20 caracteres máximo (ajustable)
        value = value.substring(0, 20);

        if (value !== control.value) {
            control.patchValue(value, { emitEvent: false });
        }

        return null; // no retorna error, solo limpieza
    };
}



    static usuarioSimple(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) return null;

        let v = control.value;

        // Solo letras, números y guion bajo
        v = v.replace(/[^a-zA-Z0-9_]/g, '');

        // Primera letra mayúscula
        v = v.charAt(0).toUpperCase() + v.slice(1);

        if (v !== control.value) {
            control.patchValue(v, { emitEvent: false });
        }

        return null;
    };
}


static passwordFuerte(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;

        if (!value) return null;

        // Sin espacios
        if (/\s/.test(value)) return { espacioNoPermitido: true };

        // Longitud
        if (value.length < 8 || value.length > 16) {
            return { longitudInvalida: true };
        }

        return null;
    };
}


static clabe(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) return null;

        let v = control.value.replace(/\D/g, '').substring(0, 18);

        if (v !== control.value) {
            control.patchValue(v, { emitEvent: false });
        }

        return v.length === 18 ? null : { clabeInvalida: true };
    };
}


static numeroTarjeta(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) return null;

        let v = control.value.replace(/\D/g, '').substring(0, 16);

        if (v !== control.value) {
            control.patchValue(v, { emitEvent: false });
        }

        return v.length === 16 ? null : { tarjetaInvalida: true };
    };
}


static bancoSimple(): ValidatorFn {
    return CustomValidators.soloTextoCapitalizado();
}

static salario(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (control.value == null) return null; // null o undefined permitido

        // Convertir a string
        let v = String(control.value)
            .replace(/[^0-9.]/g, '')  // solo números y punto
            .replace(/(\..*)\./g, '$1'); // evita más de 1 punto

        if (v !== String(control.value)) {
            control.patchValue(v, { emitEvent: false });
        }

        return null;
    };
}


}
