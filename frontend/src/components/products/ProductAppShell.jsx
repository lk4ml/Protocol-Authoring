import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getProduct } from '../../config/productRegistry';
import AppShell from '../layout/AppShell';

/**
 * ProductAppShell — thin wrapper over AppShell that passes
 * product-scoped navItems, homeUrl, and productName.
 * URL: /products/:productKey/:id/*
 */
export default function ProductAppShell() {
  const { productKey } = useParams();
  const product = getProduct(productKey);

  if (!product) return <Navigate to="/" replace />;

  return (
    <AppShell
      navItems={product.navItems}
      homeUrl={`/products/${product.key}`}
      productName={product.title}
    />
  );
}
