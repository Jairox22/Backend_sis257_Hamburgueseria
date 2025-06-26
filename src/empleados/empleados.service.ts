import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private empleadosRepository: Repository<Empleado>,
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,
  ) { }

  async create(createEmpleadoDto: CreateEmpleadoDto): Promise<Empleado> {
    // 1. Buscar el siguiente número de usuario empleadoN
    const empleados = await this.empleadosRepository.find({ relations: ['usuario'] });
    let maxN = 0;
    empleados.forEach(e => {
      const match = e.usuario?.nombreUsuario?.match(/^empleado(\d+)$/);
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxN) maxN = n;
      }
    });
    const nuevoNombreUsuario = `empleado${maxN + 1}`;

    // 2. Crear el usuario usando el método create de usuariosService
    // Suponiendo que tienes acceso a usuariosService, si no, deberías inyectarlo
    // Aquí se simula el dto necesario
    const createUsuarioDto = { nombreUsuario: nuevoNombreUsuario };
    const usuarioCreado = await this.usuariosRepository.save(
      this.usuariosRepository.create({
        nombreUsuario: nuevoNombreUsuario,
        clave: process.env.DEFAULT_PASSWORD,
      })
    );

    // 3. Crear el empleado con el id del usuario creado
    const empleado = this.empleadosRepository.create({
      nombres: createEmpleadoDto.nombres.trim(),
      apellidos: createEmpleadoDto.apellidos.trim(),
      cargo: createEmpleadoDto.cargo.trim(),
      fechaContratacion: createEmpleadoDto.fechaContratacion,
      usuario: { id: usuarioCreado.id },
    });

    const empleadoGuardado = await this.empleadosRepository.save(empleado);
    return empleadoGuardado;
  }

  async findAll(): Promise<Empleado[]> {
    return this.empleadosRepository.find({ relations: ['usuario'] });
  }

  async findOne(id: number): Promise<Empleado> {
    const existeEmpleado = await this.empleadosRepository.findOne({
      where: { id },
      relations: ['usuario'],
    });
    if (!existeEmpleado) {
      throw new NotFoundException(`EL empleado con el id ${id} no existe`);
    }
    return existeEmpleado;
  }

  async findByUsuarioId(usuarioId: number): Promise<Empleado> {
    if (!usuarioId || isNaN(Number(usuarioId))) {
      throw new NotFoundException('El id de usuario proporcionado no es válido');
    }
    const empleado = await this.empleadosRepository
      .createQueryBuilder('empleado')
      .leftJoinAndSelect('empleado.usuario', 'usuario')
      .where('usuario.id = :usuarioId', { usuarioId: Number(usuarioId) })
      .getOne();

    if (!empleado) {
      throw new NotFoundException(`No se encontró empleado para el usuario con id ${usuarioId}`);
    }
    return empleado;
  }

  async update(
    id: number,
    updateEmpleadoDto: UpdateEmpleadoDto,
  ): Promise<Empleado> {
    const empleado = await this.findOne(id);
    if (!empleado) {
      throw new NotFoundException(`El empleado con el id ${id} no existe`);
    }

    // Verificar si el usuario ya está asignado a otro empleado
    if (updateEmpleadoDto.idUsuario) {
      const empleadoExistente = await this.empleadosRepository.findOne({
        where: { usuario: { id: updateEmpleadoDto.idUsuario } },
        relations: ['usuario'],
      });
      if (empleadoExistente && empleadoExistente.id !== id) {
        throw new NotFoundException(`El usuario con id ${updateEmpleadoDto.idUsuario} ya está asignado a otro empleado`);
      }
    }

    const actualizarEmpleado = Object.assign(empleado, updateEmpleadoDto);
    if (updateEmpleadoDto.idUsuario) {
      actualizarEmpleado.usuario = { id: updateEmpleadoDto.idUsuario } as Usuario;
    }
    return this.empleadosRepository.save(actualizarEmpleado);
  }

  async remove(id: number) {
    const empleado = await this.findOne(id);
    await this.empleadosRepository.softRemove(empleado);
    return {
      message: 'Empleado eliminado exitosamente',
      empleado,
    };
  }
}
