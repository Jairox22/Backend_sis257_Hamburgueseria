import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Venta } from './entities/venta.entity';
import { DetalleVenta } from './entities/detalle_venta.entity';
import { CreateVentaDto } from './dto/create-venta.dto';
import { Producto } from '../productos/entities/producto.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Empleado } from '../empleados/entities/empleado.entity';

@Injectable()
export class VentasService {
  constructor(
    @InjectRepository(Venta)
    private ventaRepository: Repository<Venta>,
    @InjectRepository(DetalleVenta)
    private detalleVentaRepository: Repository<DetalleVenta>,
    @InjectRepository(Producto)
    private productoRepository: Repository<Producto>,
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
    @InjectRepository(Empleado)
    private empleadoRepository: Repository<Empleado>,
    private dataSource: DataSource,
  ) {}

  async obtenerVentas(): Promise<Venta[]> {
    console.log('Obteniendo todas las ventas...');
    const ventas = await this.ventaRepository.find({
      relations: [
        'cliente',
        'empleado',
        'ventadetalles',
        'ventadetalles.producto',
      ],
    });
    console.log('Ventas obtenidas:', ventas);
    return ventas;
  }

  async obtenerVentaPorId(id: number): Promise<Venta> {
    console.log(`Buscando venta por ID: ${id}`);
    const venta = await this.ventaRepository.findOne({
      where: { id },
      relations: [
        'cliente',
        'empleado',
        'ventadetalles',
        'ventadetalles.producto',
      ],
    });

    if (!venta) {
      console.log(`No se encontró la venta con ID: ${id}`);
      throw new NotFoundException(`La venta con ID ${id} no fue encontrada`);
    }

    console.log('Venta encontrada:', venta);
    return venta;
  }

  async obtenerVentaDetalles(id: number): Promise<DetalleVenta[]> {
    const venta = await this.ventaRepository.findOne({
      where: { id },
      relations: ['ventadetalles', 'ventadetalles.producto'],
    });

    if (!venta) {
      throw new NotFoundException(`La venta con ID ${id} no fue encontrada`);
    }

    if (!venta.ventadetalles || venta.ventadetalles.length === 0) {
      throw new NotFoundException(
        `No se encontraron detalles para la venta con ID ${id}`,
      );
    }

    return venta.ventadetalles;
  }

  async crearVenta(createVentaDto: CreateVentaDto): Promise<Venta> {
    console.log('Iniciando creación de venta con DTO:', createVentaDto);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let cliente = null;
      if (createVentaDto.idCliente) {
        console.log(`Buscando cliente con ID: ${createVentaDto.idCliente}`);
        cliente = await this.clienteRepository.findOne({
          where: { id: createVentaDto.idCliente },
        });
        if (!cliente) {
          console.log(
            `Cliente con ID ${createVentaDto.idCliente} no encontrado`,
          );
          throw new NotFoundException(
            `Cliente con ID ${createVentaDto.idCliente} no encontrado`,
          );
        }
        console.log('Cliente encontrado:', cliente);
      }

      console.log(`Buscando empleado con ID: ${createVentaDto.idEmpleado}`);
      const empleado = await this.empleadoRepository.findOne({
        where: { id: createVentaDto.idEmpleado },
      });
      if (!empleado) {
        console.log(
          `Empleado con ID ${createVentaDto.idEmpleado} no encontrado`,
        );
        throw new NotFoundException(
          `Empleado con ID ${createVentaDto.idEmpleado} no encontrado`,
        );
      }
      console.log('Empleado encontrado:', empleado);

      // Validar montoPagado en el DTO
      if (
        typeof createVentaDto.montoPagado !== 'number' ||
        isNaN(createVentaDto.montoPagado) ||
        createVentaDto.montoPagado < 0
      ) {
        throw new BadRequestException('El monto pagado debe ser un número positivo');
      }

      const nuevaVenta = this.ventaRepository.create({
        metodoPago: 'efectivo',
        totalVenta: 0,
        estado: 'realizada',
        montoPagado: 0, // Se actualizará después de calcular el total
        cambio: 0,      // Se actualizará después de calcular el total
      });

      if (cliente) {
        nuevaVenta.cliente = cliente;
      }
      nuevaVenta.empleado = empleado;

      console.log('Guardando nueva venta (sin detalles aún)...', nuevaVenta);
      const ventaGuardada = await queryRunner.manager.save(nuevaVenta);
      console.log('Venta guardada:', ventaGuardada);

      let totalVenta = 0;

      if (!createVentaDto.detalles || !createVentaDto.detalles.length) {
        console.log('No se proporcionaron detalles de venta');
        throw new BadRequestException(
          'La venta debe contener al menos un detalle',
        );
      }

      for (const detalle of createVentaDto.detalles) {
        console.log('Procesando detalle:', detalle);
        const producto = await this.productoRepository.findOne({
          where: { id: detalle.idProducto },
        });

        if (!producto) {
          console.log(`Producto con ID ${detalle.idProducto} no encontrado`);
          throw new NotFoundException(
            `Producto con ID ${detalle.idProducto} no encontrado`,
          );
        }
        console.log('Producto encontrado:', producto);

        const cantidadNum = Number(detalle.cantidad);
        if (isNaN(cantidadNum) || cantidadNum <= 0) {
          console.log(
            `Cantidad inválida para el producto ${producto.nombre}:`,
            detalle.cantidad,
          );
          throw new BadRequestException(
            `La cantidad para el producto ${producto.nombre} debe ser un número positivo`,
          );
        }

        if (producto.stock < cantidadNum) {
          console.log(
            `Stock insuficiente para el producto ${producto.nombre}. Stock actual: ${producto.stock}, solicitado: ${cantidadNum}`,
          );
          throw new BadRequestException(
            `Stock insuficiente para el producto ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidadNum}`,
          );
        }

        const precioUnitario = Number(producto.precioUnitario);
        const subtotal = precioUnitario * cantidadNum;

        console.log(
          `Creando detalle de venta para producto ${producto.nombre}: cantidad=${cantidadNum}, precioUnitario=${precioUnitario}, subtotal=${subtotal}`,
        );
        const nuevoDetalle = this.detalleVentaRepository.create({
          cantidad: cantidadNum,
          precioUnitario: precioUnitario,
          subtotal: subtotal,
          venta: { id: ventaGuardada.id },
          producto: { id: producto.id },
        });

        await queryRunner.manager.save(nuevoDetalle);
        console.log('Detalle de venta guardado:', nuevoDetalle);

        producto.stock -= cantidadNum;
        await queryRunner.manager.save(producto);
        console.log(
          `Stock actualizado para producto ${producto.nombre}: nuevo stock=${producto.stock}`,
        );

        totalVenta += subtotal;
        console.log(
          `Subtotal sumado al totalVenta. Total actual: ${totalVenta}`,
        );
      }

      // Calcular cambio
      const montoPagado = Number(createVentaDto.montoPagado);
      if (montoPagado < totalVenta) {
        throw new BadRequestException(
          `El monto pagado (${montoPagado}) es menor al total de la venta (${totalVenta})`,
        );
      }
      const cambio = Number((montoPagado - totalVenta).toFixed(2));

      ventaGuardada.totalVenta = totalVenta;
      ventaGuardada.montoPagado = montoPagado;
      ventaGuardada.cambio = cambio;
      await queryRunner.manager.save(ventaGuardada);
      console.log('Total de la venta, monto pagado y cambio actualizados:', {
        totalVenta,
        montoPagado,
        cambio,
      });

      await queryRunner.commitTransaction();
      console.log('Transacción confirmada. Venta creada exitosamente.');

      return this.obtenerVentaPorId(ventaGuardada.id);
    } catch (error) {
      console.log('Ocurrió un error durante la creación de la venta:', error);
      await queryRunner.rollbackTransaction();

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al procesar la venta: ' + error.message,
      );
    } finally {
      await queryRunner.release();
      console.log('QueryRunner liberado.');
    }
  }

  async anularVenta(id: number): Promise<Venta> {
    console.log(`Iniciando anulación de venta con ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const venta = await this.ventaRepository.findOne({
        where: { id },
        relations: ['ventadetalles', 'ventadetalles.producto'],
      });

      if (!venta) {
        console.log(`Venta con ID ${id} no encontrada para anular`);
        throw new NotFoundException(`La venta con ID ${id} no fue encontrada`);
      }

      if (venta.estado === 'anulada') {
        console.log(`La venta con ID ${id} ya está anulada`);
        throw new BadRequestException(`La venta con ID ${id} ya está anulada`);
      }

      const fechaAnulacion = new Date();

      console.log('Restaurando stock de productos de la venta...');
      for (const detalle of venta.ventadetalles) {
        const producto = await this.productoRepository.findOne({
          where: { id: detalle.producto.id },
        });

        if (producto) {
          const cantidadNum = Number(detalle.cantidad);
          if (!isNaN(cantidadNum)) {
            producto.stock += cantidadNum;
            await queryRunner.manager.save(producto);
            console.log(
              `Stock restaurado para producto ${producto.nombre}: nuevo stock=${producto.stock}`,
            );
          } else {
            console.log(
              `Cantidad inválida en detalle de venta para producto ID ${producto.id}`,
            );
          }
        } else {
          console.log(
            `Producto con ID ${detalle.producto.id} no encontrado al restaurar stock`,
          );
        }

        // Actualizar fechaAnulacion en el detalle
        detalle.fechaAnulacion = fechaAnulacion;
        await queryRunner.manager.save(detalle);
      }

      venta.estado = 'anulada';
      venta.totalVenta = 0;
      venta.fechaAnulacion = fechaAnulacion;
      await queryRunner.manager.save(venta);
      console.log('Venta marcada como anulada, totalVenta puesto en 0 y fechaAnulacion actualizada');

      await queryRunner.commitTransaction();
      console.log('Transacción de anulación confirmada.');

      return venta;
    } catch (error) {
      console.log('Ocurrió un error durante la anulación de la venta:', error);
      await queryRunner.rollbackTransaction();

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al anular la venta: ' + error.message,
      );
    } finally {
      await queryRunner.release();
      console.log('QueryRunner liberado tras anulación.');
    }
  }

  async limpiarVentasAnuladas(): Promise<{
    cantidadRegistrosEliminados: number;
    mensaje?: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Buscar ventas anuladas
      const ventasAnuladas = await this.ventaRepository.find({
        where: { estado: 'anulada' },
        relations: ['ventadetalles'],
      });

      if (ventasAnuladas.length === 0) {
        return {
          cantidadRegistrosEliminados: 0,
          mensaje: 'No se encontraron ventas anuladas para eliminar.',
        };
      }

      // Soft-remove detalles de cada venta anulada
      let detallesEliminados = 0;
      for (const venta of ventasAnuladas) {
        if (venta.ventadetalles && venta.ventadetalles.length > 0) {
          for (const detalle of venta.ventadetalles) {
            await queryRunner.manager.softRemove(DetalleVenta, detalle);
            detallesEliminados++;
          }
        }
        // Soft-remove la venta anulada
        await queryRunner.manager.softRemove(Venta, venta);
      }

      await queryRunner.commitTransaction();

      return {
        cantidadRegistrosEliminados: ventasAnuladas.length,
        mensaje: `Ventas anuladas eliminadas (soft): ${ventasAnuladas.length}, detalles eliminados (soft): ${detallesEliminados}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        'Error al limpiar ventas anuladas: ' + error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
