import { isArray } from 'lodash';

export function customizer(lhs: any, rhs: any): any {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}
