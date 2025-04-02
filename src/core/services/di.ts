/**
 * DIContainer - Dependency Injection Container
 *
 * This module provides a dependency injection container that can register services
 * and resolve their dependencies automatically.
 */
import logger from '@/utils/logger';

// Type for service dependencies that should be resolved from the container
type ServiceDependency = {
  serviceId: string;
};

interface ServiceClass<T> {
	serviceId: string; // 静态属性
	new (...args: any[]): T; // 构造函数
}

// Type for dependency definition
type ServiceConstructor<T, P extends any[] = any[]> = new (...args: P) => T;

interface ServiceRegistrationOptions<T, P extends any[] = any[]> {
  factory: ServiceConstructor<T, P> | ((...args: P) => T | Promise<T>);
  dependencies: P;
  singleton?: boolean;  // Default is true
}

/**
 * Dependency Injection Container
 */
export class DIContainer {
	private services: Map<string, ServiceRegistrationOptions<any>> = new Map();
	private instances: Map<string, any> = new Map();
	private dependencyGraph: Map<string, Set<string>> = new Map();
	private initializing: Set<string> = new Set();

	/**
   * Register a service with the container
   * 
   * @param serviceId - Unique identifier for the service
   * @param options - Service registration options
   */
	register<T, P extends any[] = []>(serviceId: string, options: ServiceRegistrationOptions<T, P>): void {
		if (this.services.has(serviceId)) {
			throw new Error(`Service with ID '${serviceId}' is already registered`);
		}

		this.registerOrUpdate(serviceId, options);
	}

	/**
   * Update a registered service
   * 
   * @param serviceId - Unique identifier for the service
   * @param options - Service registration options
   */
	update<T, P extends any[] = []>(serviceId: string, options: ServiceRegistrationOptions<T, P>): void {
		if (!this.services.has(serviceId)) {
			throw new Error(`Service with ID '${serviceId}' is not registered`);
		}

		// Remove existing instance if any
		this.instances.delete(serviceId);
    
		// Remove from dependency graph
		this.dependencyGraph.delete(serviceId);
    
		// Update the service
		this.registerOrUpdate(serviceId, options);
	}

	/**
   * Internal method to register or update a service
   */
	private registerOrUpdate<T, P extends any[] = []>(serviceId: string, options: ServiceRegistrationOptions<T, P>): void {
		// Store the service registration
		this.services.set(serviceId, options);
    
		// Build dependency graph for cycle detection
		const dependencies = new Set<string>();
		this.dependencyGraph.set(serviceId, dependencies);
    
		// Add service dependencies to the graph
		if (options.dependencies && options.dependencies.length > 0) {
			for (const dep of options.dependencies) {
				if (typeof dep === 'object' && dep !== null && dep.serviceId) {
					dependencies.add(dep.serviceId);
				}
			}
		}
    
		// Check for circular dependencies first
		try {
			this.checkForCircularDependencies(serviceId);
		} catch (error) {
			// Remove the service if circular dependency is detected
			this.services.delete(serviceId);
			this.dependencyGraph.delete(serviceId);
			throw error;
		}
	}

	/**
   * Get a service instance from the container
   * 
   * @param serviceId - The ID of the service to retrieve
   * @returns A promise that resolves to the service instance
   */
	async get<T>(serviceId: string): Promise<T> {
		if (!this.services.has(serviceId)) {
			throw new Error(`Service with ID '${serviceId}' is not registered`);
		}

		const registration = this.services.get(serviceId)!;
    
		// For singletons, return the cached instance if available
		if (registration.singleton !== false && this.instances.has(serviceId)) {
			return this.instances.get(serviceId) as T;
		}
    
		// Check for circular initialization
		if (this.initializing.has(serviceId)) {
			throw new Error(`Circular dependency detected while initializing '${serviceId}'`);
		}
    
		this.initializing.add(serviceId);
    
		try {
			// Resolve dependencies
			const resolvedDependencies: any[] = [];
      
			if (registration.dependencies && registration.dependencies.length > 0) {
				for (let i = 0; i < registration.dependencies.length; i++) {
					const dep = registration.dependencies[i];
					if (typeof dep === 'object' && dep !== null && dep.serviceId) {
						// Check if dependency service is registered
						if (!this.services.has(dep.serviceId)) {
							throw new Error(
								`Service '${serviceId}' depends on unregistered service '${dep.serviceId}' at index ${i}`
							);
						}
						// Resolve service dependency
						resolvedDependencies.push(await this.get(dep.serviceId));
					} else {
						// Direct dependency, use as-is
						resolvedDependencies.push(dep);
					}
				}
			}
      
			// Create instance with resolved dependencies
			let instance: T;
      
			if (typeof registration.factory === 'function' && 
          !this.isConstructor(registration.factory)) {
				// Factory function
				const factory = registration.factory as (...args: any[]) => T | Promise<T>;
				const result = factory(...resolvedDependencies);
				instance = result instanceof Promise ? await result : result;
			} else {
				// Constructor
				const constructor = registration.factory as ServiceConstructor<T>;
				instance = new constructor(...resolvedDependencies);
			}
      
			// Cache instance if it's a singleton
			if (registration.singleton !== false) {
				this.instances.set(serviceId, instance);
			}
      
			return instance;
		} catch (e){
			logger.error('DIContainer get error', e);
			throw e;
		} finally{
			this.initializing.delete(serviceId);
		}
	}

	async getByType<T>(service: ServiceClass<T>): Promise<T> {
		return this.get<T>(service.serviceId);
	}

	/**
   * Check if a function is a constructor
   */
	// eslint-disable-next-line @typescript-eslint/ban-types
	private isConstructor(func: Function): boolean {
		return !!func.prototype && !!func.prototype.constructor.name;
	}

	/**
   * Validate that all service dependencies are registered
   */
	private validateDependencies(serviceId: string): void {
		const registration = this.services.get(serviceId)!;
    
		if (!registration.dependencies || registration.dependencies.length === 0) {
			return;
		}
    
		for (let i = 0; i < registration.dependencies.length; i++) {
			const dep = registration.dependencies[i];
			if (typeof dep === 'object' && dep !== null && dep.serviceId) {
				if (!this.services.has(dep.serviceId)) {
					throw new Error(
						`Service '${serviceId}' depends on unregistered service '${dep.serviceId}' at index ${i}`
					);
				}
			}
		}
	}

	/**
   * Check for circular dependencies in the dependency graph
   */
	private checkForCircularDependencies(serviceId: string, visited: Set<string> = new Set(), path: string[] = []): void {
		visited.add(serviceId);
		path.push(serviceId);
    
		const dependencies = this.dependencyGraph.get(serviceId) || new Set();
    
		for (const dependency of dependencies) {
			if (path.includes(dependency)) {
				throw new Error(
					`Circular dependency detected: ${path.join(' -> ')} -> ${dependency}`
				);
			}
      
			if (!visited.has(dependency) && this.dependencyGraph.has(dependency)) {
				this.checkForCircularDependencies(dependency, visited, [...path]);
			}
		}
	}

	/**
   * Create a service dependency reference
   * @param service - The service to reference
   * @returns A service dependency reference, monkey-patched to the correct type, be careful this is not a real constructor
   */
	static service<T extends ServiceDependency>(service: ServiceDependency): T {
		return { serviceId: service.serviceId } as any;
	}
}
