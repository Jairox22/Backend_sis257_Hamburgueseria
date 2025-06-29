import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Venta } from 'src/ventas/entities/venta.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 50, nullable: false })
  nombres: string;

  @Column('varchar', { length: 50, nullable: false })
  apellidos: string;

  @Column('varchar', { length: 30, nullable: false })
  cargo: string;

  @Column({ type: 'date', name: 'fecha_contratacion' })
  fechaContratacion: Date;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_modificacion' })
  fechaModificacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date;

  //un empleado puede tener un usuario
  @OneToOne(() => Usuario, (usuario) => usuario.empleados)
  @JoinColumn({ name: 'id_usuario', referencedColumnName: 'id' })
  usuario: Usuario;

  @OneToMany(() => Venta, (venta) => venta.empleado)
  ventas: Venta[];
}
