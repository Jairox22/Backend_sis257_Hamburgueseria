import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateEmpleadoDto } from './create-empleado.dto';
import { IsDefined, IsNumber } from 'class-validator';

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) {
    @ApiProperty({ example: 1 })
    @IsDefined({ message: 'El campo idUsuario debe estar definido' })
    @IsNumber({}, { message: 'El campo idUsuario debe ser de tipo numérico' })
    readonly idUsuario: number;
}
