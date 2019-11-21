{ pkgs ? import <nixpkgs> {} }:
with pkgs;

yarn2nix-moretea.mkYarnPackage {
  src = ./.;
}
