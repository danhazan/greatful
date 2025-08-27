"""
Base repository class with standardized query patterns and error handling.
"""

import logging
from typing import Any, Dict, List, Optional, Type, TypeVar, Union, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import func, desc, asc, and_, or_, text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.core.exceptions import NotFoundError, ConflictError, DatabaseError

logger = logging.getLogger(__name__)

T = TypeVar('T')


class QueryBuilder:
    """Builder pattern for constructing complex queries."""
    
    def __init__(self, model_class: Type[T]):
        self.model_class = model_class
        self.query = select(model_class)
        self._filters = []
        self._joins = []
        self._order_by = []
        self._limit_value = None
        self._offset_value = None
        self._load_relationships = []
    
    def filter(self, *conditions) -> 'QueryBuilder':
        """Add WHERE conditions."""
        self._filters.extend(conditions)
        return self
    
    def filter_by(self, **kwargs) -> 'QueryBuilder':
        """Add WHERE conditions using keyword arguments."""
        for key, value in kwargs.items():
            if hasattr(self.model_class, key):
                self._filters.append(getattr(self.model_class, key) == value)
        return self
    
    def join(self, *args, **kwargs) -> 'QueryBuilder':
        """Add JOIN clauses."""
        self._joins.append((args, kwargs))
        return self
    
    def order_by(self, *columns) -> 'QueryBuilder':
        """Add ORDER BY clauses."""
        self._order_by.extend(columns)
        return self
    
    def limit(self, limit: int) -> 'QueryBuilder':
        """Add LIMIT clause."""
        self._limit_value = limit
        return self
    
    def offset(self, offset: int) -> 'QueryBuilder':
        """Add OFFSET clause."""
        self._offset_value = offset
        return self
    
    def load_relationships(self, *relationships) -> 'QueryBuilder':
        """Add relationship loading."""
        self._load_relationships.extend(relationships)
        return self
    
    def build(self):
        """Build the final query."""
        query = self.query
        
        # Apply filters
        if self._filters:
            query = query.where(and_(*self._filters))
        
        # Apply joins
        for join_args, join_kwargs in self._joins:
            query = query.join(*join_args, **join_kwargs)
        
        # Apply relationship loading
        for relationship in self._load_relationships:
            if hasattr(self.model_class, relationship):
                query = query.options(selectinload(getattr(self.model_class, relationship)))
        
        # Apply ordering
        if self._order_by:
            query = query.order_by(*self._order_by)
        
        # Apply limit and offset
        if self._limit_value is not None:
            query = query.limit(self._limit_value)
        if self._offset_value is not None:
            query = query.offset(self._offset_value)
        
        return query


class BaseRepository:
    """Base repository with standardized query patterns and error handling."""
    
    def __init__(self, db: AsyncSession, model_class: Type[T]):
        self.db = db
        self.model_class = model_class
        self.logger = logging.getLogger(f"{__name__}.{model_class.__name__}Repository")
    
    def query(self) -> QueryBuilder:
        """Create a new query builder."""
        return QueryBuilder(self.model_class)
    
    async def _execute_query(self, query, error_context: str = "database operation"):
        """Execute query with standardized error handling."""
        try:
            result = await self.db.execute(query)
            return result
        except IntegrityError as e:
            self.logger.error(f"Integrity error during {error_context}: {e}")
            raise ConflictError(f"Data integrity violation during {error_context}")
        except SQLAlchemyError as e:
            self.logger.error(f"Database error during {error_context}: {e}")
            raise DatabaseError(f"Database operation failed: {error_context}")
        except Exception as e:
            self.logger.error(f"Unexpected error during {error_context}: {e}")
            raise DatabaseError(f"Unexpected error during {error_context}")
    
    async def get_by_id(
        self, 
        entity_id: Any, 
        load_relationships: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Get entity by ID with optional relationship loading.
        
        Args:
            entity_id: ID of the entity
            load_relationships: List of relationship names to load
            
        Returns:
            Optional[T]: The entity if found, None otherwise
        """
        builder = self.query().filter(self.model_class.id == entity_id)
        
        if load_relationships:
            builder = builder.load_relationships(*load_relationships)
        
        query = builder.build()
        result = await self._execute_query(query, f"get {self.model_class.__name__} by id")
        entity = result.scalar_one_or_none()
        
        if entity:
            self.logger.debug(f"Found {self.model_class.__name__} with id: {entity_id}")
        
        return entity
    
    async def get_by_id_or_404(
        self, 
        entity_id: Any, 
        load_relationships: Optional[List[str]] = None
    ) -> T:
        """
        Get entity by ID or raise 404 error.
        
        Args:
            entity_id: ID of the entity
            load_relationships: List of relationship names to load
            
        Returns:
            T: The entity
            
        Raises:
            NotFoundError: If entity is not found
        """
        entity = await self.get_by_id(entity_id, load_relationships)
        if not entity:
            raise NotFoundError(self.model_class.__name__, str(entity_id))
        return entity
    
    async def create(self, **kwargs) -> T:
        """
        Create a new entity.
        
        Args:
            **kwargs: Entity attributes
            
        Returns:
            T: The created entity
        """
        try:
            entity = self.model_class(**kwargs)
            self.db.add(entity)
            await self.db.commit()
            await self.db.refresh(entity)
            
            self.logger.info(f"Created {self.model_class.__name__} with id: {entity.id}")
            return entity
            
        except IntegrityError as e:
            await self.db.rollback()
            self.logger.error(f"Integrity error creating {self.model_class.__name__}: {e}")
            raise ConflictError(f"Data integrity violation creating {self.model_class.__name__}")
        except SQLAlchemyError as e:
            await self.db.rollback()
            self.logger.error(f"Database error creating {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Failed to create {self.model_class.__name__}")
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"Unexpected error creating {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Unexpected error creating {self.model_class.__name__}")
    
    async def update(self, entity: T, **kwargs) -> T:
        """
        Update an existing entity.
        
        Args:
            entity: The entity to update
            **kwargs: Attributes to update
            
        Returns:
            T: The updated entity
        """
        try:
            for key, value in kwargs.items():
                if hasattr(entity, key):
                    setattr(entity, key, value)
            
            await self.db.commit()
            await self.db.refresh(entity)
            
            self.logger.info(f"Updated {self.model_class.__name__} with id: {entity.id}")
            return entity
            
        except IntegrityError as e:
            await self.db.rollback()
            self.logger.error(f"Integrity error updating {self.model_class.__name__}: {e}")
            raise ConflictError(f"Data integrity violation updating {self.model_class.__name__}")
        except SQLAlchemyError as e:
            await self.db.rollback()
            self.logger.error(f"Database error updating {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Failed to update {self.model_class.__name__}")
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"Unexpected error updating {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Unexpected error updating {self.model_class.__name__}")
    
    async def delete(self, entity: T) -> bool:
        """
        Delete an entity.
        
        Args:
            entity: The entity to delete
            
        Returns:
            bool: True if deleted successfully
        """
        try:
            await self.db.delete(entity)
            await self.db.commit()
            
            self.logger.info(f"Deleted {self.model_class.__name__} with id: {entity.id}")
            return True
            
        except SQLAlchemyError as e:
            await self.db.rollback()
            self.logger.error(f"Database error deleting {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Failed to delete {self.model_class.__name__}")
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"Unexpected error deleting {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Unexpected error deleting {self.model_class.__name__}")
    
    async def find_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[Any] = None,
        load_relationships: Optional[List[str]] = None
    ) -> List[T]:
        """
        Find all entities matching criteria.
        
        Args:
            filters: Dictionary of filters to apply
            order_by: Order by clause
            load_relationships: List of relationship names to load
            
        Returns:
            List[T]: List of matching entities
        """
        builder = self.query()
        
        if filters:
            builder = builder.filter_by(**filters)
        
        if order_by is not None:
            builder = builder.order_by(order_by)
        
        if load_relationships:
            builder = builder.load_relationships(*load_relationships)
        
        query = builder.build()
        result = await self._execute_query(query, f"find all {self.model_class.__name__}")
        entities = result.scalars().all()
        
        self.logger.debug(f"Found {len(entities)} {self.model_class.__name__} entities")
        return entities
    
    async def find_one(
        self,
        filters: Optional[Dict[str, Any]] = None,
        load_relationships: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Find one entity matching criteria.
        
        Args:
            filters: Dictionary of filters to apply
            load_relationships: List of relationship names to load
            
        Returns:
            Optional[T]: The entity if found, None otherwise
        """
        builder = self.query()
        
        if filters:
            builder = builder.filter_by(**filters)
        
        if load_relationships:
            builder = builder.load_relationships(*load_relationships)
        
        query = builder.build()
        result = await self._execute_query(query, f"find one {self.model_class.__name__}")
        return result.scalar_one_or_none()
    
    async def paginate(
        self,
        page: int = 1,
        per_page: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[Any] = None,
        load_relationships: Optional[List[str]] = None
    ) -> tuple[List[T], int]:
        """
        Get paginated results with total count.
        
        Args:
            page: Page number (1-based)
            per_page: Number of items per page
            filters: Dictionary of filters to apply
            order_by: Order by clause
            load_relationships: List of relationship names to load
            
        Returns:
            tuple: (results, total_count)
        """
        offset = (page - 1) * per_page
        
        # Build base query for counting
        count_builder = self.query()
        if filters:
            count_builder = count_builder.filter_by(**filters)
        
        # Get total count
        count_query = select(func.count()).select_from(count_builder.build().subquery())
        count_result = await self._execute_query(count_query, f"count {self.model_class.__name__}")
        total_count = count_result.scalar() or 0
        
        # Build paginated query
        builder = self.query()
        if filters:
            builder = builder.filter_by(**filters)
        if order_by is not None:
            builder = builder.order_by(order_by)
        if load_relationships:
            builder = builder.load_relationships(*load_relationships)
        
        builder = builder.limit(per_page).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, f"paginate {self.model_class.__name__}")
        entities = result.scalars().all()
        
        self.logger.debug(f"Paginated {self.model_class.__name__}: page {page}, {len(entities)} items, {total_count} total")
        return entities, total_count
    
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities matching criteria.
        
        Args:
            filters: Dictionary of filters to apply
            
        Returns:
            int: Number of matching entities
        """
        builder = self.query()
        if filters:
            builder = builder.filter_by(**filters)
        
        count_query = select(func.count()).select_from(builder.build().subquery())
        result = await self._execute_query(count_query, f"count {self.model_class.__name__}")
        count = result.scalar() or 0
        
        self.logger.debug(f"Counted {count} {self.model_class.__name__} entities")
        return count
    
    async def exists(self, filters: Dict[str, Any]) -> bool:
        """
        Check if entity exists matching criteria.
        
        Args:
            filters: Dictionary of filters to apply
            
        Returns:
            bool: True if entity exists, False otherwise
        """
        count = await self.count(filters)
        return count > 0
    
    async def execute_raw_query(
        self, 
        query: Union[str, text], 
        params: Optional[Dict[str, Any]] = None
    ):
        """
        Execute raw SQL query with parameters.
        
        Args:
            query: SQL query string or text() object
            params: Query parameters
            
        Returns:
            Query result
        """
        if isinstance(query, str):
            query = text(query)
        
        return await self._execute_query(
            query if params is None else query.params(**params),
            "raw query execution"
        )
    
    async def bulk_create(self, entities_data: List[Dict[str, Any]]) -> List[T]:
        """
        Create multiple entities in bulk.
        
        Args:
            entities_data: List of entity data dictionaries
            
        Returns:
            List[T]: List of created entities
        """
        try:
            entities = [self.model_class(**data) for data in entities_data]
            self.db.add_all(entities)
            await self.db.commit()
            
            # Refresh all entities to get their IDs
            for entity in entities:
                await self.db.refresh(entity)
            
            self.logger.info(f"Bulk created {len(entities)} {self.model_class.__name__} entities")
            return entities
            
        except IntegrityError as e:
            await self.db.rollback()
            self.logger.error(f"Integrity error in bulk create {self.model_class.__name__}: {e}")
            raise ConflictError(f"Data integrity violation in bulk create {self.model_class.__name__}")
        except SQLAlchemyError as e:
            await self.db.rollback()
            self.logger.error(f"Database error in bulk create {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Failed to bulk create {self.model_class.__name__}")
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"Unexpected error in bulk create {self.model_class.__name__}: {e}")
            raise DatabaseError(f"Unexpected error in bulk create {self.model_class.__name__}")