import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('Customer not found');

    const productsExists = await this.productsRepository.findAllById(products);
    /* if (!productsExists?.length) throw new AppError('Products not found');
    if (productsExists.length !== products.length)
      throw new AppError('Some product not be found'); */

    products.map(product => {
      const productsExist = productsExists.find(p => p.id === product.id);
      if (!productsExist) throw new AppError(`Product ${product.id} not found`);
      if (product.quantity > productsExist.quantity)
        throw new AppError(
          `Product ${product.id} dont have quantity available`,
        );
    });

    const orderProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.find(p => p.id === product.id)?.price ?? 0,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const updateQuantity = products.map(product => ({
      id: product.id,
      quantity:
        (productsExists.find(p => p.id === product.id)?.quantity ?? 0) -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateQuantity);

    return order;
  }
}

export default CreateOrderService;
