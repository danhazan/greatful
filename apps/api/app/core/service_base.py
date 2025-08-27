"""
Base service class with common patterns and utilities.
"""

import logging
from typing import Any, Dict, List, Optional, Type, TypeVar
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.exceptions import NotFoundError, ValidationException

logger = logging.getLogger(__name__)

T = TypeVar('T')


class BaseService:
    """Base service class with common database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(
        self,
        model_class: Type[T],
        entity_id: Any,
        load_relationships: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Get entity by ID with optional relationship loading.
        
        Args:
            model_class: SQLAlchemy model class
            entity_id: ID of the entity
            load_relationships: List of relationship names to load
            
        Returns:
            Optional[T]: The entity if found, None otherwise
        """
        query = select(model_class).where(model_class.id == entity_id)
        
        if load_relationships:
            for relationship in load_relationships:
                query = query.options(selectinload(getattr(model_class, relationship)))
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_id_or_404(
        self,
        model_class: Type[T],
        entity_id: Any,
        resource_name: str,
        load_relationships: Optional[List[str]] = None
    ) -> T:
        """
        Get entity by ID or raise 404 error.
        
        Args:
            model_class: SQLAlchemy model class
            entity_id: ID of the entity
            resource_name: Name of the resource for error messages
            load_relationships: List of relationship names to load
            
        Returns:
            T: The entity
            
        Raises:
            NotFoundError: If entity is not found
        """
        entity = await self.get_by_id(model_class, entity_id, load_relationships)
        if not entity:
            raise NotFoundError(resource_name, str(entity_id))
        return entity

    async def create_entity(
        self,
        model_class: Type[T],
        **kwargs
    ) -> T:
        """
        Create a new entity.
        
        Args:
            model_class: SQLAlchemy model class
            **kwargs: Entity attributes
            
        Returns:
            T: The created entity
        """
        entity = model_class(**kwargs)
        self.db.add(entity)
        await self.db.commit()
        await self.db.refresh(entity)
        logger.info(f"Created {model_class.__name__} with id: {entity.id}")
        return entity

    async def update_entity(
        self,
        entity: T,
        **kwargs
    ) -> T:
        """
        Update an existing entity.
        
        Args:
            entity: The entity to update
            **kwargs: Attributes to update
            
        Returns:
            T: The updated entity
        """
        for key, value in kwargs.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
        
        await self.db.commit()
        await self.db.refresh(entity)
        logger.info(f"Updated {entity.__class__.__name__} with id: {entity.id}")
        return entity

    async def delete_entity(self, entity: T) -> bool:
        """
        Delete an entity.
        
        Args:
            entity: The entity to delete
            
        Returns:
            bool: True if deleted successfully
        """
        await self.db.delete(entity)
        await self.db.commit()
        logger.info(f"Deleted {entity.__class__.__name__} with id: {entity.id}")
        return True

    async def get_paginated(
        self,
        model_class: Type[T],
        limit: int = 20,
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[Any] = None,
        load_relationships: Optional[List[str]] = None
    ) -> tuple[List[T], int]:
        """
        Get paginated results.
        
        Args:
            model_class: SQLAlchemy model class
            limit: Maximum number of results
            offset: Number of results to skip
            filters: Dictionary of filters to apply
            order_by: Order by clause
            load_relationships: List of relationship names to load
            
        Returns:
            tuple: (results, total_count)
        """
        query = select(model_class)
        
        # Apply filters
        if filters:
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.where(getattr(model_class, key) == value)
        
        # Apply ordering
        if order_by is not None:
            query = query.order_by(order_by)
        
        # Load relationships
        if load_relationships:
            for relationship in load_relationships:
                query = query.options(selectinload(getattr(model_class, relationship)))
        
        # Get total count
        count_query = select(model_class)
        if filters:
            for key, value in filters.items():
                if hasattr(model_class, key):
                    count_query = count_query.where(getattr(model_class, key) == value)
        
        from sqlalchemy import func
        count_result = await self.db.execute(select(func.count()).select_from(count_query.subquery()))
        total_count = count_result.scalar() or 0
        
        # Get paginated results
        paginated_query = query.limit(limit).offset(offset)
        result = await self.db.execute(paginated_query)
        results = result.scalars().all()
        
        return results, total_count

    def validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> None:
        """
        Validate that required fields are present.
        
        Args:
            data: Data dictionary to validate
            required_fields: List of required field names
            
        Raises:
            ValidationException: If required fields are missing
        """
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            raise ValidationException(
                f"Missing required fields: {', '.join(missing_fields)}",
                {field: "This field is required" for field in missing_fields}
            )

    def validate_field_length(
        self,
        value: str,
        field_name: str,
        max_length: int,
        min_length: int = 0
    ) -> None:
        """
        Validate field length.
        
        Args:
            value: Value to validate
            field_name: Name of the field
            max_length: Maximum allowed length
            min_length: Minimum allowed length
            
        Raises:
            ValidationException: If length is invalid
        """
        if len(value) < min_length:
            raise ValidationException(
                f"{field_name} must be at least {min_length} characters long",
                {field_name: f"Minimum length is {min_length}"}
            )
        
        if len(value) > max_length:
            raise ValidationException(
                f"{field_name} must be at most {max_length} characters long",
                {field_name: f"Maximum length is {max_length}"}
            )

    async def check_unique_constraint(
        self,
        model_class: Type[T],
        field_name: str,
        value: Any,
        exclude_id: Optional[Any] = None
    ) -> None:
        """
        Check if a field value is unique.
        
        Args:
            model_class: SQLAlchemy model class
            field_name: Name of the field to check
            value: Value to check for uniqueness
            exclude_id: ID to exclude from the check (for updates)
            
        Raises:
            ValidationException: If value is not unique
        """
        query = select(model_class).where(getattr(model_class, field_name) == value)
        
        if exclude_id is not None:
            query = query.where(model_class.id != exclude_id)
        
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValidationException(
                f"{field_name.replace('_', ' ').title()} already exists",
                {field_name: "This value is already taken"}
            )