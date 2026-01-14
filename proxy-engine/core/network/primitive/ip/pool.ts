// pool.ts - IP address pool for rotation

import { IPv4Address, IPv6Address } from "./ip_handling.ts";

/**
 * IP address pool for IP rotation
 */
export class IPAddressPool {
  private addresses: string[];
  private currentIndex: number;
  private strategy: 'round-robin' | 'random';

  constructor(addresses: string[], strategy: 'round-robin' | 'random' = 'round-robin') {
    if (addresses.length === 0) {
      throw new Error('IP address pool cannot be empty');
    }
    this.addresses = addresses;
    this.currentIndex = 0;
    this.strategy = strategy;
  }

  /**
   * Get next IP address from pool
   */
  next(): string {
    if (this.strategy === 'random') {
      const index = Math.floor(Math.random() * this.addresses.length);
      return this.addresses[index];
    }

    // Round-robin
    const address = this.addresses[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.addresses.length;
    return address;
  }

  /**
   * Get a specific IP by index
   */
  get(index: number): string | null {
    if (index < 0 || index >= this.addresses.length) {
      return null;
    }
    return this.addresses[index];
  }

  /**
   * Add an address to the pool
   */
  add(address: string): void {
    if (!this.addresses.includes(address)) {
      this.addresses.push(address);
    }
  }

  /**
   * Remove an address from the pool
   */
  remove(address: string): boolean {
    const index = this.addresses.indexOf(address);
    if (index !== -1) {
      this.addresses.splice(index, 1);
      // Adjust current index if needed
      if (this.currentIndex >= this.addresses.length) {
        this.currentIndex = 0;
      }
      return true;
    }
    return false;
  }

  /**
   * Get pool size
   */
  size(): number {
    return this.addresses.length;
  }

  /**
   * Get all addresses
   */
  getAll(): string[] {
    return [...this.addresses];
  }

  /**
   * Reset the pool index
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Set rotation strategy
   */
  setStrategy(strategy: 'round-robin' | 'random'): void {
    this.strategy = strategy;
  }
}
